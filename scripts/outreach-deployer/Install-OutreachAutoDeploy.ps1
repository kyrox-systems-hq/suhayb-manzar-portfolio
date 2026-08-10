$ErrorActionPreference = 'Stop'

$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$ProjectId = 'suhayb-manzar-portfolio'
$HostingRoot = 'https://suhayb-manzar-portfolio.web.app'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCliDir = Join-Path $Root 'firebase-cli'
$FirebaseCmd = Join-Path $FirebaseCliDir 'node_modules\.bin\firebase.cmd'
$WatcherSource = Join-Path $RepoDir 'scripts\outreach-deployer\Watch-OutreachDeploy.ps1'
$Watcher = Join-Path $Root 'Watch-OutreachDeploy.ps1'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'final-repair.log'
$MarkerRel = 'public/mockups/.deploy-ready'
$ProofRel = 'public/mockups/_system/auto-deploy-proof.txt'
$ProofUrl = "$HostingRoot/mockups/_system/auto-deploy-proof.txt"
$StartupDir = [Environment]::GetFolderPath('Startup')
$StartupCmd = Join-Path $StartupDir 'Kyrox-Outreach-AutoDeploy.cmd'
$OldTaskName = 'Kyrox Outreach Auto Deploy'
$stage = 'startup'

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Write-RepairLog {
    param([string]$Message)
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    Add-Content -LiteralPath $LogFile -Value ("{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $stage, $Message)
}

function Invoke-Native {
    param([string]$FilePath,[string[]]$Arguments=@())
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = (& $FilePath @Arguments 2>&1 | Out-String)
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $old
    }
    [pscustomobject]@{ Code=$code; Output=$output.Trim() }
}

function Invoke-InteractiveNative {
    param([string]$FilePath,[string[]]$Arguments=@())
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $FilePath @Arguments
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $old
    }
    return $code
}

function Ensure-WingetPackage {
    param([string]$Command,[string]$PackageId)
    if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Command is missing and winget is unavailable."
    }
    Write-Host "Installing $PackageId..."
    $r = Invoke-Native -FilePath 'winget' -Arguments @(
        'install','--id',$PackageId,'-e','--source','winget',
        '--accept-package-agreements','--accept-source-agreements','--silent'
    )
    if ($r.Code -ne 0) { throw "winget failed to install $PackageId: $($r.Output)" }
    Refresh-Path
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$PackageId installed, but $Command is not yet in PATH. Restart Windows once, then run this file again."
    }
}

function Stop-OldAutomation {
    $task = Get-ScheduledTask -TaskName $OldTaskName -ErrorAction SilentlyContinue
    if ($null -ne $task) {
        try { Stop-ScheduledTask -TaskName $OldTaskName -ErrorAction SilentlyContinue } catch {}
        Unregister-ScheduledTask -TaskName $OldTaskName -Confirm:$false -ErrorAction SilentlyContinue
    }

    try {
        Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
            Where-Object { $_.CommandLine -and $_.CommandLine -like '*Watch-OutreachDeploy.ps1*' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch {}

    if (Test-Path -LiteralPath $StartupCmd) {
        Remove-Item -LiteralPath $StartupCmd -Force
    }
}

function Test-LiveText {
    param([string]$Url,[string]$Expected)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
        if ([int]$r.StatusCode -ge 200 -and [int]$r.StatusCode -lt 400 -and $r.Content -eq $Expected) {
            return $true
        }
    } catch {}
    return $false
}

function Test-LiveMissing {
    param([string]$Url)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
        return ([int]$r.StatusCode -eq 404)
    } catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) { return $true }
        return $false
    }
}

function Wait-ForMarker {
    param([string]$ExpectedSha,[int]$TimeoutSeconds=240)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $StateFile) {
            $actual = (Get-Content -LiteralPath $StateFile -Raw).Trim()
            if ($actual -eq $ExpectedSha) { return $true }
        }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Git-CommitPush {
    param([string]$Message)
    $commit = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'commit','-m',$Message)
    if ($commit.Code -ne 0) { throw "git commit failed: $($commit.Output)" }
    $push = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'push','origin',$Branch)
    if ($push.Code -ne 0) { throw "git push failed: $($push.Output)" }
}

function Get-MarkerBlobSha {
    $r = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'hash-object',$MarkerRel)
    if ($r.Code -ne 0 -or -not $r.Output.Trim()) { throw "Could not calculate marker SHA: $($r.Output)" }
    return $r.Output.Trim()
}

try {
    Write-Host ''
    Write-Host 'Kyrox Outreach Auto Deploy - clean final repair'
    Write-Host '-----------------------------------------------'
    Write-Host ''

    $stage = 'remove_old_automation'
    Write-Host '[1/8] Removing the old scheduled-task version...'
    Stop-OldAutomation

    $stage = 'prerequisites'
    Write-Host '[2/8] Validating Git, GitHub CLI, Node.js and npm...'
    Ensure-WingetPackage -Command 'git' -PackageId 'Git.Git'
    Ensure-WingetPackage -Command 'gh' -PackageId 'GitHub.cli'
    Ensure-WingetPackage -Command 'node' -PackageId 'OpenJS.NodeJS.LTS'
    Refresh-Path
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is unavailable.' }

    $stage = 'github_auth'
    Write-Host '[3/8] Validating GitHub access...'
    $auth = Invoke-Native -FilePath 'gh' -Arguments @('auth','status','--hostname','github.com')
    if ($auth.Code -ne 0) {
        $code = Invoke-InteractiveNative -FilePath 'gh' -Arguments @('auth','login','--hostname','github.com','--git-protocol','https','--web')
        if ($code -ne 0) { throw 'GitHub sign-in failed.' }
    }
    $view = Invoke-Native -FilePath 'gh' -Arguments @('repo','view',$Repo,'--json','nameWithOwner')
    if ($view.Code -ne 0) { throw "GitHub cannot access $Repo." }
    $setup = Invoke-Native -FilePath 'gh' -Arguments @('auth','setup-git','--hostname','github.com')
    if ($setup.Code -ne 0) { throw "GitHub credential-helper setup failed: $($setup.Output)" }

    $stage = 'clean_repo'
    Write-Host '[4/8] Creating a clean local checkout...'
    if (Test-Path -LiteralPath $Root) {
        Get-ChildItem -LiteralPath $Root -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -ne $LogFile } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $Root -Force | Out-Null

    $clone = Invoke-Native -FilePath 'gh' -Arguments @('repo','clone',$Repo,$RepoDir,'--','--branch',$Branch,'--single-branch')
    if ($clone.Code -ne 0) { throw "Repository clone failed: $($clone.Output)" }

    $gitName = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'config','user.name','Kyrox Outreach Auto Deploy')
    if ($gitName.Code -ne 0) { throw "Could not set local git user.name: $($gitName.Output)" }
    $gitEmail = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'config','user.email','suhayb.manzar@outlook.com')
    if ($gitEmail.Code -ne 0) { throw "Could not set local git user.email: $($gitEmail.Output)" }

    $WatcherSource = Join-Path $RepoDir 'scripts\outreach-deployer\Watch-OutreachDeploy.ps1'
    if (-not (Test-Path -LiteralPath $WatcherSource)) { throw 'Canonical watcher is missing from the repository.' }

    $stage = 'firebase'
    Write-Host '[5/8] Installing and proving Firebase CLI access...'
    New-Item -ItemType Directory -Path $FirebaseCliDir -Force | Out-Null
    $npm = Invoke-Native -FilePath 'npm.cmd' -Arguments @(
        'install','--prefix',$FirebaseCliDir,'firebase-tools@latest','--no-audit','--no-fund','--loglevel=error'
    )
    if ($npm.Code -ne 0 -or -not (Test-Path -LiteralPath $FirebaseCmd)) {
        throw "Firebase CLI installation failed: $($npm.Output)"
    }

    $projects = Invoke-Native -FilePath $FirebaseCmd -Arguments @('projects:list','--json')
    if ($projects.Code -ne 0 -or $projects.Output -notmatch [regex]::Escape($ProjectId)) {
        Write-Host 'Firebase needs one browser sign-in.'
        $code = Invoke-InteractiveNative -FilePath $FirebaseCmd -Arguments @('login','--reauth')
        if ($code -ne 0) { throw 'Firebase sign-in failed.' }
        $projects = Invoke-Native -FilePath $FirebaseCmd -Arguments @('projects:list','--json')
        if ($projects.Code -ne 0 -or $projects.Output -notmatch [regex]::Escape($ProjectId)) {
            throw "Firebase login cannot access $ProjectId."
        }
    }

    Push-Location $RepoDir
    try {
        $deploy = Invoke-Native -FilePath $FirebaseCmd -Arguments @('deploy','--only','hosting','--project',$ProjectId,'--non-interactive')
    } finally {
        Pop-Location
    }
    if ($deploy.Code -ne 0) { throw "Direct Firebase deployment failed: $($deploy.Output)" }

    $stage = 'install_login_watcher'
    Write-Host '[6/8] Installing the hidden login watcher...'
    Copy-Item -LiteralPath $WatcherSource -Destination $Watcher -Force
    if (Test-Path -LiteralPath $StateFile) { Remove-Item -LiteralPath $StateFile -Force }

    $startupContent = @"
@echo off
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$Watcher"
"@
    Set-Content -LiteralPath $StartupCmd -Value $startupContent -Encoding ascii

    $watcherArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Watcher`""
    Start-Process -FilePath 'powershell.exe' -ArgumentList $watcherArgs -WindowStyle Hidden
    Start-Sleep -Seconds 2

    $stage = 'live_self_test'
    Write-Host '[7/8] Running a real automatic-deployment test...'
    $proofId = "KYROX_AUTO_DEPLOY_$([guid]::NewGuid().ToString('N'))"
    $proofPath = Join-Path $RepoDir ($ProofRel -replace '/', '\')
    $markerPath = Join-Path $RepoDir ($MarkerRel -replace '/', '\')
    New-Item -ItemType Directory -Path (Split-Path -Parent $proofPath) -Force | Out-Null
    Set-Content -LiteralPath $proofPath -Value $proofId -Encoding ascii
    Set-Content -LiteralPath $markerPath -Value ("slug=thespinedlife`nselftest=$proofId`nrequested_at_utc=$((Get-Date).ToUniversalTime().ToString('o'))") -Encoding utf8

    $add = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'add',$ProofRel,$MarkerRel)
    if ($add.Code -ne 0) { throw "git add failed: $($add.Output)" }
    Git-CommitPush -Message 'Trigger outreach auto-deploy live self-test'
    $markerSha = Get-MarkerBlobSha

    if (-not (Wait-ForMarker -ExpectedSha $markerSha -TimeoutSeconds 240)) {
        throw 'The login watcher did not process the test marker within four minutes.'
    }

    $liveDeadline = (Get-Date).AddMinutes(2)
    $livePassed = $false
    while ((Get-Date) -lt $liveDeadline) {
        if (Test-LiveText -Url $ProofUrl -Expected ($proofId + "`n")) {
            $livePassed = $true
            break
        }
        if (Test-LiveText -Url $ProofUrl -Expected $proofId) {
            $livePassed = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $livePassed) { throw 'The watcher ran, but the unique proof file did not appear on Firebase.' }

    $stage = 'cleanup_self_test'
    Write-Host '[8/8] Removing the test file and proving automatic cleanup...'
    Remove-Item -LiteralPath $proofPath -Force
    $cleanupId = [guid]::NewGuid().ToString('N')
    Set-Content -LiteralPath $markerPath -Value ("slug=thespinedlife`ncleanup=$cleanupId`nrequested_at_utc=$((Get-Date).ToUniversalTime().ToString('o'))") -Encoding utf8
    $add = Invoke-Native -FilePath 'git' -Arguments @('-C',$RepoDir,'add','-A','--',$ProofRel,$MarkerRel)
    if ($add.Code -ne 0) { throw "git cleanup add failed: $($add.Output)" }
    Git-CommitPush -Message 'Clean outreach auto-deploy self-test'
    $cleanupMarkerSha = Get-MarkerBlobSha

    if (-not (Wait-ForMarker -ExpectedSha $cleanupMarkerSha -TimeoutSeconds 240)) {
        throw 'The watcher did not process the cleanup marker within four minutes.'
    }

    $goneDeadline = (Get-Date).AddMinutes(2)
    $gone = $false
    while ((Get-Date) -lt $goneDeadline) {
        if (Test-LiveMissing -Url $ProofUrl) {
            $gone = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $gone) { throw 'The temporary proof file was not removed from Firebase after cleanup.' }

    Write-RepairLog 'FULL END-TO-END VALIDATION PASSED.'
    Write-Host ''
    Write-Host 'FULL END-TO-END VALIDATION PASSED' -ForegroundColor Green
    Write-Host ''
    Write-Host 'The system is now proven:'
    Write-Host 'GitHub marker -> hidden Windows watcher -> Git pull -> Firebase deploy -> live proof -> automatic cleanup.'
    Write-Host ''
    Write-Host 'No GitHub Actions, no Task Scheduler, and no Codex deployment step remain.'
    exit 0
}
catch {
    $message = $_.Exception.Message
    try { Write-RepairLog "FAILED: $message" } catch {}
    try { Stop-OldAutomation } catch {}
    Write-Host ''
    Write-Host "FINAL REPAIR FAILED at stage: $stage" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red
    Write-Host ''
    Write-Host 'No broken background automation has been left running.'
    Write-Host "Log: $LogFile"
    exit 1
}
