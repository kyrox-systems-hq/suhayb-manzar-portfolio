$ErrorActionPreference = 'Stop'

$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCliDir = Join-Path $Root 'firebase-cli'
$FirebaseCmd = Join-Path $FirebaseCliDir 'node_modules\.bin\firebase.cmd'
$Watcher = Join-Path $RepoDir 'scripts\outreach-deployer\Watch-OutreachDeploy.ps1'
$TaskName = 'Kyrox Outreach Auto Deploy'
$StatusPath = 'public/mockups/.deploy-status'
$stage = 'startup'

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Ensure-WingetPackage {
    param([string]$Command,[string]$PackageId)
    if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "$Command is not installed and winget is unavailable." }
    & winget install --id $PackageId -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Failed to install $PackageId." }
    Refresh-Path
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { throw "$Command was installed but is not available in PATH yet. Reopen PowerShell and run this installer again." }
}

function Publish-InstallerStatus {
    param([string]$Status,[string]$Stage,[string]$Detail)
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return }
    $safe = ($Detail -replace "`r|`n", ' ').Trim()
    if ($safe.Length -gt 500) { $safe = $safe.Substring(0,500) }
    $body = @"
status=$Status
marker_sha=installer
stage=$Stage
detail=$safe
firebase_project=suhayb-manzar-portfolio
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($body))
    $statusSha = (& gh api "repos/$Repo/contents/$StatusPath?ref=$([uri]::EscapeDataString($Branch))" --jq '.sha' 2>$null | Out-String).Trim()
    $message = if ($Status -eq 'success') { 'Record outreach deployer installation success' } else { 'Record outreach deployer installation failure' }
    $args = @('api',"repos/$Repo/contents/$StatusPath",'--method','PUT','-f',"message=$message",'-f',"content=$encoded",'-f',"branch=$Branch")
    if ($statusSha) { $args += @('-f',"sha=$statusSha") }
    & gh @args *> $null
}

try {
    $stage = 'prepare'
    New-Item -ItemType Directory -Path $Root -Force | Out-Null

    $stage = 'install_prerequisites'
    Ensure-WingetPackage -Command 'git' -PackageId 'Git.Git'
    Ensure-WingetPackage -Command 'gh' -PackageId 'GitHub.cli'
    Ensure-WingetPackage -Command 'node' -PackageId 'OpenJS.NodeJS.LTS'
    Refresh-Path
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is not available after Node.js installation.' }

    $stage = 'github_auth'
    & gh auth status --hostname github.com *> $null
    if ($LASTEXITCODE -ne 0) {
        & gh auth login --hostname github.com --git-protocol https --web --scopes repo
        if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication failed.' }
    }
    & gh auth refresh --hostname github.com --scopes repo
    if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication does not have private-repository access.' }
    & gh auth setup-git
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure Git to use GitHub authentication.' }

    $stage = 'sync_repository'
    if (-not (Test-Path $RepoDir)) {
        & gh repo clone $Repo $RepoDir -- --branch $Branch --single-branch
        if ($LASTEXITCODE -ne 0) { throw 'Repository clone failed.' }
    } else {
        & git -C $RepoDir fetch origin $Branch --prune
        if ($LASTEXITCODE -ne 0) { throw 'Repository fetch failed.' }
        & git -C $RepoDir checkout -B $Branch "origin/$Branch"
        if ($LASTEXITCODE -ne 0) { throw 'Repository checkout failed.' }
        & git -C $RepoDir reset --hard "origin/$Branch"
        if ($LASTEXITCODE -ne 0) { throw 'Repository reset failed.' }
    }

    $stage = 'install_firebase_cli'
    New-Item -ItemType Directory -Path $FirebaseCliDir -Force | Out-Null
    $npmOutput = (& npm.cmd install --prefix $FirebaseCliDir firebase-tools@latest --no-audit --no-fund 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $FirebaseCmd)) { throw "Firebase CLI npm installation failed: $npmOutput" }

    $stage = 'firebase_auth'
    & $FirebaseCmd projects:list --non-interactive *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'A browser will open once so Firebase can authorise this PC.'
        & $FirebaseCmd login
        if ($LASTEXITCODE -ne 0) { throw 'Firebase login failed.' }
    }
    $projects = (& $FirebaseCmd projects:list --json 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $projects -notmatch 'suhayb-manzar-portfolio') { throw "This Firebase login cannot access suhayb-manzar-portfolio: $projects" }

    $stage = 'initial_deploy'
    if (-not (Test-Path $Watcher)) { throw "Watcher script not found at $Watcher" }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Watcher
    if ($LASTEXITCODE -ne 0) { throw "Initial deployment failed. Check $Root\deploy.log" }

    $stage = 'schedule_task'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Watcher`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 2)
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

    Publish-InstallerStatus -Status 'success' -Stage 'installed' -Detail 'npm Firebase CLI installed, initial deployment completed, and scheduled task registered.'
    Write-Host ''
    Write-Host 'Outreach auto-deployment is installed.'
    Write-Host 'Future changes to public/mockups/.deploy-ready will deploy automatically to Firebase.'
}
catch {
    $message = $_.Exception.Message
    try { Publish-InstallerStatus -Status 'failure' -Stage $stage -Detail $message } catch {}
    Write-Host ''
    Write-Host "SETUP FAILED at stage: $stage" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red
    exit 1
}
