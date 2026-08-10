$ErrorActionPreference = 'Stop'

$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$Root = 'C:\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseExe = Join-Path $Root 'firebase.exe'
$Watcher = Join-Path $RepoDir 'scripts\outreach-deployer\Watch-OutreachDeploy.ps1'
$TaskName = 'Kyrox Outreach Auto Deploy'

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Ensure-WingetPackage {
    param(
        [string]$Command,
        [string]$PackageId
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Command is not installed and winget is unavailable."
    }

    & winget install --id $PackageId -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Failed to install $PackageId." }
    Refresh-Path

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$Command was installed but is not available in PATH yet. Reopen PowerShell and run this installer again."
    }
}

New-Item -ItemType Directory -Path $Root -Force | Out-Null

Ensure-WingetPackage -Command 'git' -PackageId 'Git.Git'
Ensure-WingetPackage -Command 'gh' -PackageId 'GitHub.cli'

& gh auth status --hostname github.com *> $null
if ($LASTEXITCODE -ne 0) {
    & gh auth login --hostname github.com --git-protocol https --web --scopes repo
    if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication failed.' }
}

& gh auth setup-git
if ($LASTEXITCODE -ne 0) { throw 'Could not configure Git to use GitHub authentication.' }

if (-not (Test-Path $RepoDir)) {
    & gh repo clone $Repo $RepoDir -- --branch $Branch --single-branch
    if ($LASTEXITCODE -ne 0) { throw 'Repository clone failed.' }
}
else {
    & git -C $RepoDir fetch origin $Branch --prune
    if ($LASTEXITCODE -ne 0) { throw 'Repository fetch failed.' }
    & git -C $RepoDir checkout -B $Branch "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'Repository checkout failed.' }
    & git -C $RepoDir reset --hard "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'Repository reset failed.' }
}

Invoke-WebRequest -Uri 'https://firebase.tools/bin/win/instant/latest' -OutFile $FirebaseExe
if (-not (Test-Path $FirebaseExe)) { throw 'Firebase CLI download failed.' }

& $FirebaseExe projects:list --non-interactive *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'A browser will open once so Firebase can authorise this PC.'
    & $FirebaseExe login
    if ($LASTEXITCODE -ne 0) { throw 'Firebase login failed.' }
}

$projects = (& $FirebaseExe projects:list --json | Out-String)
if ($LASTEXITCODE -ne 0 -or $projects -notmatch 'suhayb-manzar-portfolio') {
    throw 'This Firebase login cannot access suhayb-manzar-portfolio.'
}

if (-not (Test-Path $Watcher)) {
    throw "Watcher script not found at $Watcher"
}

# Run once immediately. With no saved marker this performs an initial deployment and proves the setup works.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Watcher
if ($LASTEXITCODE -ne 0) {
    throw "Initial deployment failed. Check $Root\deploy.log"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Watcher`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host ''
Write-Host 'Outreach auto-deployment is installed.'
Write-Host 'Future changes to public/mockups/.deploy-ready will deploy automatically to Firebase.'
Write-Host "Log: $Root\deploy.log"
