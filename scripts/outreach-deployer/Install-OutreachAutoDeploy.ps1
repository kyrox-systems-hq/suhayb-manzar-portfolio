$ErrorActionPreference = 'Stop'

$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$ProjectId = 'suhayb-manzar-portfolio'
$HostingRoot = 'https://suhayb-manzar-portfolio.web.app'
$TestSlug = 'thespinedlife'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCliDir = Join-Path $Root 'firebase-cli'
$FirebaseCmd = Join-Path $FirebaseCliDir 'node_modules\.bin\firebase.cmd'
$WatcherSource = Join-Path $RepoDir 'scripts\outreach-deployer\Watch-OutreachDeploy.ps1'
$Watcher = Join-Path $Root 'Watch-OutreachDeploy.ps1'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'final-repair.log'

$MarkerPath = 'public/mockups/.deploy-ready'
$StatusPath = 'public/mockups/.deploy-status'
$TaskName = 'Kyrox Outreach Auto Deploy'
$stage = 'startup'

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Write-RepairLog {
    param([string]$Message)
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    $line = "{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $stage, $Message
    Add-Content -LiteralPath $LogFile -Value $line
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @()
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = (& $FilePath @Arguments 2>&1 | Out-String)
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    [pscustomobject]@{
        Code = $code
        Output = $output.Trim()
    }
}

function Invoke-InteractiveNative {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @()
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $FilePath @Arguments
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    return $code
}

function Ensure-WingetPackage {
    param(
        [string]$Command,
        [string]$PackageId
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        return
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Command is missing and Windows Package Manager (winget) is unavailable."
    }

    Write-Host "Installing $PackageId..."
    $install = Invoke-Native -FilePath 'winget' -Arguments @(
        'install',
        '--id', $PackageId,
        '-e',
        '--source', 'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--silent'
    )

    if ($install.Code -ne 0) {
        throw "winget failed to install $PackageId: $($install.Output)"
    }

    Refresh-Path
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$PackageId installed, but $Command is still unavailable in PATH. Restart Windows and run this repair once."
    }
}

function Get-RemoteFile {
    param([string]$Path)

    $encodedBranch = [uri]::EscapeDataString($Branch)
    $result = Invoke-Native -FilePath 'gh' -Arguments @(
        'api',
        "repos/$Repo/contents/$Path?ref=$encodedBranch"
    )

    if ($result.Code -ne 0) {
        return $null
    }

    return ($result.Output | ConvertFrom-Json)
}

function Decode-GitHubContent {
    param([object]$FileObject)

    if ($null -eq $FileObject -or -not $FileObject.content) {
        return ''
    }

    $base64 = ($FileObject.content -replace '\s', '')
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
}

function Put-RemoteFile {
    param(
        [string]$Path,
        [string]$Content,
        [string]$Message
    )

    $existing = Get-RemoteFile -Path $Path
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Content))

    $arguments = @(
        'api',
        "repos/$Repo/contents/$Path",
        '--method', 'PUT',
        '-f', "message=$Message",
        '-f', "content=$encoded",
        '-f', "branch=$Branch"
    )

    if ($null -ne $existing -and $existing.sha) {
        $arguments += @('-f', "sha=$($existing.sha)")
    }

    $result = Invoke-Native -FilePath 'gh' -Arguments $arguments
    if ($result.Code -ne 0) {
        throw "GitHub could not update $Path: $($result.Output)"
    }

    return ($result.Output | ConvertFrom-Json)
}

function Assert-WebPage {
    param(
        [string]$Url,
        [string]$RequiredText = '',
        [switch]$RequireNoIndex
    )

    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
        throw "HTTP $($response.StatusCode) from $Url"
    }

    if ($RequiredText -and $response.Content -notmatch [regex]::Escape($RequiredText)) {
        throw "Expected '$RequiredText' was not found at $Url"
    }

    if ($RequireNoIndex) {
        $robots = [string]$response.Headers['X-Robots-Tag']
        if ($robots -notmatch 'noindex') {
            throw "X-Robots-Tag noindex was not present at $Url"
        }
    }

    return $response
}

function Stop-And-RemoveOldTask {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $task) {
        try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    }
}

function Publish-RepairFailure {
    param([string]$Detail)

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        return
    }

    $safe = (($Detail -replace "`r|`n", ' ') -replace '\s+', ' ').Trim()
    if ($safe.Length -gt 700) {
        $safe = $safe.Substring(0, 700)
    }

    $content = @"
status=failure
marker_sha=repair
stage=$stage
deployed_at_utc=$((Get-Date).ToUniversalTime().ToString('o'))
firebase_project=$ProjectId
live_url=
detail=$safe
"@

    try {
        Put-RemoteFile -Path $StatusPath -Content $content -Message 'Record final outreach auto-deploy repair failure' | Out-Null
    }
    catch {}
}

try {
    Write-Host ''
    Write-Host 'Kyrox Outreach Auto Deploy - final repair and end-to-end validation'
    Write-Host '----------------------------------------------------------------'
    Write-Host ''

    $stage = 'clean_reset'
    Write-Host '[1/9] Removing previous broken deployment setup...'
    Stop-And-RemoveOldTask
    if (Test-Path -LiteralPath $Root) {
        Remove-Item -LiteralPath $Root -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    Write-RepairLog 'Clean reset complete.'

    $stage = 'prerequisites'
    Write-Host '[2/9] Validating Git, GitHub CLI, Node.js and npm...'
    Ensure-WingetPackage -Command 'git' -PackageId 'Git.Git'
    Ensure-WingetPackage -Command 'gh' -PackageId 'GitHub.cli'
    Ensure-WingetPackage -Command 'node' -PackageId 'OpenJS.NodeJS.LTS'
    Refresh-Path

    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm is unavailable even though Node.js is installed.'
    }

    foreach ($probe in @(
        @{File='git'; Args=@('--version')},
        @{File='gh'; Args=@('--version')},
        @{File='node'; Args=@('--version')},
        @{File='npm.cmd'; Args=@('--version')}
    )) {
        $result = Invoke-Native -FilePath $probe.File -Arguments $probe.Args
        if ($result.Code -ne 0) {
            throw "$($probe.File) failed its version check: $($result.Output)"
        }
        Write-RepairLog "$($probe.File): $($result.Output -split '\r?\n' | Select-Object -First 1)"
    }

    $stage = 'github_auth'
    Write-Host '[3/9] Validating GitHub authentication and repository access...'
    $auth = Invoke-Native -FilePath 'gh' -Arguments @('auth', 'status', '--hostname', 'github.com')
    if ($auth.Code -ne 0) {
        Write-Host 'GitHub needs one browser sign-in.'
        $code = Invoke-InteractiveNative -FilePath 'gh' -Arguments @(
            'auth', 'login',
            '--hostname', 'github.com',
            '--git-protocol', 'https',
            '--web'
        )
        if ($code -ne 0) {
            throw 'GitHub browser authentication failed.'
        }
    }

    $repoAccess = Invoke-Native -FilePath 'gh' -Arguments @(
        'repo', 'view', $Repo,
        '--json', 'nameWithOwner'
    )
    if ($repoAccess.Code -ne 0) {
        Write-Host 'Refreshing GitHub private-repository permission...'
        $code = Invoke-InteractiveNative -FilePath 'gh' -Arguments @(
            'auth', 'refresh',
            '--hostname', 'github.com',
            '--scopes', 'repo'
        )
        if ($code -ne 0) {
            throw 'GitHub repository permission refresh failed.'
        }

        $repoAccess = Invoke-Native -FilePath 'gh' -Arguments @(
            'repo', 'view', $Repo,
            '--json', 'nameWithOwner'
        )
        if ($repoAccess.Code -ne 0) {
            throw "GitHub authentication cannot access $Repo."
        }
    }

    $gitSetup = Invoke-Native -FilePath 'gh' -Arguments @('auth', 'setup-git', '--hostname', 'github.com')
    if ($gitSetup.Code -ne 0) {
        throw "Could not configure GitHub CLI as Git's credential helper: $($gitSetup.Output)"
    }
    Write-RepairLog 'GitHub authentication and repository access passed.'

    $stage = 'repository_sync'
    Write-Host '[4/9] Cloning the exact outreach branch cleanly...'
    $clone = Invoke-Native -FilePath 'gh' -Arguments @(
        'repo', 'clone', $Repo, $RepoDir,
        '--',
        '--branch', $Branch,
        '--single-branch'
    )
    if ($clone.Code -ne 0) {
        throw "Repository clone failed: $($clone.Output)"
    }

    foreach ($requiredFile in @(
        (Join-Path $RepoDir 'firebase.json'),
        (Join-Path $RepoDir '.firebaserc'),
        (Join-Path $RepoDir 'public\mockups\thespinedlife\index.html'),
        $WatcherSource
    )) {
        if (-not (Test-Path -LiteralPath $requiredFile)) {
            throw "Required repository file is missing: $requiredFile"
        }
    }
    Write-RepairLog 'Repository sync passed.'

    $stage = 'firebase_cli'
    Write-Host '[5/9] Installing and validating the npm Firebase CLI...'
    New-Item -ItemType Directory -Path $FirebaseCliDir -Force | Out-Null

    $npmInstall = Invoke-Native -FilePath 'npm.cmd' -Arguments @(
        'install',
        '--prefix', $FirebaseCliDir,
        'firebase-tools@latest',
        '--no-audit',
        '--no-fund',
        '--loglevel=error'
    )
    if ($npmInstall.Code -ne 0) {
        throw "npm Firebase CLI installation failed: $($npmInstall.Output)"
    }
    if (-not (Test-Path -LiteralPath $FirebaseCmd)) {
        throw "npm completed but firebase.cmd was not created at $FirebaseCmd"
    }

    $firebaseVersion = Invoke-Native -FilePath $FirebaseCmd -Arguments @('--version')
    if ($firebaseVersion.Code -ne 0) {
        throw "Firebase CLI version check failed: $($firebaseVersion.Output)"
    }
    Write-RepairLog "Firebase CLI: $($firebaseVersion.Output)"

    $stage = 'firebase_auth'
    Write-Host '[6/9] Validating Firebase login and project access...'
    $projects = Invoke-Native -FilePath $FirebaseCmd -Arguments @('projects:list', '--json')
    if ($projects.Code -ne 0 -or $projects.Output -notmatch [regex]::Escape($ProjectId)) {
        Write-Host 'Firebase needs one browser sign-in. Choose the Google account that can deploy this project.'
        $code = Invoke-InteractiveNative -FilePath $FirebaseCmd -Arguments @('login', '--reauth')
        if ($code -ne 0) {
            throw 'Firebase browser authentication failed.'
        }

        $projects = Invoke-Native -FilePath $FirebaseCmd -Arguments @('projects:list', '--json')
        if ($projects.Code -ne 0 -or $projects.Output -notmatch [regex]::Escape($ProjectId)) {
            throw "The Firebase login still cannot access $ProjectId. Output: $($projects.Output)"
        }
    }
    Write-RepairLog 'Firebase authentication and project access passed.'

    $stage = 'manual_deploy'
    Write-Host '[7/9] Proving a direct Firebase Hosting deployment before installing automation...'
    Push-Location $RepoDir
    try {
        $deploy = Invoke-Native -FilePath $FirebaseCmd -Arguments @(
            'deploy',
            '--only', 'hosting',
            '--project', $ProjectId,
            '--non-interactive'
        )
    }
    finally {
        Pop-Location
    }

    if ($deploy.Code -ne 0) {
        throw "Direct Firebase Hosting deployment failed: $($deploy.Output)"
    }

    $testUrl = "$HostingRoot/mockups/$TestSlug/"
    Assert-WebPage -Url "$HostingRoot/" | Out-Null
    Assert-WebPage -Url $testUrl -RequiredText 'TheSpinedLife' -RequireNoIndex | Out-Null
    Assert-WebPage -Url $testUrl -RequiredText 'All tees 10% off' | Out-Null
    Write-RepairLog 'Direct deploy and live HTTP verification passed.'

    $stage = 'install_watcher'
    Write-Host '[8/9] Installing the watcher and Windows task...'
    Copy-Item -LiteralPath $WatcherSource -Destination $Watcher -Force
    if (Test-Path -LiteralPath $StateFile) {
        Remove-Item -LiteralPath $StateFile -Force
    }

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Watcher`""
    $repeatTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($repeatTrigger, $logonTrigger) -Settings $settings -Principal $principal -Force | Out-Null

    $registered = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if ($null -eq $registered) {
        throw 'Windows scheduled task was not registered.'
    }
    Write-RepairLog 'Scheduled task registered.'

    $stage = 'end_to_end_selftest'
    Write-Host '[9/9] Running a real end-to-end marker -> task -> Firebase -> live-site test...'

    $selfTestId = [guid]::NewGuid().ToString('N')
    $markerContent = @"
slug=$TestSlug
selftest_id=$selfTestId
requested_at_utc=$((Get-Date).ToUniversalTime().ToString('o'))
"@

    $markerPut = Put-RemoteFile -Path $MarkerPath -Content $markerContent -Message 'Trigger final outreach auto-deploy self-test'
    $newMarkerSha = [string]$markerPut.content.sha
    if (-not $newMarkerSha) {
        $markerCheck = Get-RemoteFile -Path $MarkerPath
        $newMarkerSha = [string]$markerCheck.sha
    }
    if (-not $newMarkerSha) {
        throw 'Could not determine the self-test marker SHA.'
    }

    if (Test-Path -LiteralPath $StateFile) {
        Remove-Item -LiteralPath $StateFile -Force
    }

    Start-ScheduledTask -TaskName $TaskName

    $deadline = (Get-Date).AddMinutes(4)
    $selfTestPassed = $false
    $lastStatusText = ''

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5

        $statusFile = Get-RemoteFile -Path $StatusPath
        if ($null -eq $statusFile) {
            continue
        }

        $statusText = Decode-GitHubContent -FileObject $statusFile
        $lastStatusText = $statusText

        if ($statusText -match "(?m)^marker_sha=$([regex]::Escape($newMarkerSha))$") {
            if ($statusText -match '(?m)^status=success$') {
                $selfTestPassed = $true
                break
            }

            if ($statusText -match '(?m)^status=failure$') {
                throw "Automated watcher reported failure: $statusText"
            }
        }
    }

    if (-not $selfTestPassed) {
        throw "Timed out waiting for automated deployment acknowledgement. Last status: $lastStatusText"
    }

    Start-Sleep -Seconds 3
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($taskInfo.LastTaskResult -ne 0) {
        throw "The scheduled task completed with Windows result code $($taskInfo.LastTaskResult)."
    }

    Assert-WebPage -Url $testUrl -RequiredText 'TheSpinedLife' -RequireNoIndex | Out-Null
    Assert-WebPage -Url $testUrl -RequiredText 'All tees 10% off' | Out-Null

    Write-RepairLog "END-TO-END VALIDATION PASSED for marker $newMarkerSha"

    Write-Host ''
    Write-Host 'FINAL VALIDATION PASSED' -ForegroundColor Green
    Write-Host ''
    Write-Host 'The complete chain has been proven:'
    Write-Host 'GitHub marker -> Windows task -> branch pull -> Firebase deploy -> live URL -> GitHub acknowledgement.'
    Write-Host ''
    Write-Host 'Future outreach deployments are automatic while this PC is on and you are signed in.'
    Write-Host "Log: $LogFile"
    exit 0
}
catch {
    $message = $_.Exception.Message
    try { Write-RepairLog "FAILED: $message" } catch {}
    try { Publish-RepairFailure -Detail $message } catch {}
    try { Stop-And-RemoveOldTask } catch {}

    Write-Host ''
    Write-Host "FINAL REPAIR FAILED at stage: $stage" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red
    Write-Host ''
    Write-Host 'The automatic task has been removed so no broken background process is left running.'
    Write-Host "Log: $LogFile"
    exit 1
}
