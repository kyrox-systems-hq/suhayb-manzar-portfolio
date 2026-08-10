$ErrorActionPreference = 'Stop'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCliDir = Join-Path $Root 'firebase-cli'
$FirebaseCmd = Join-Path $FirebaseCliDir 'node_modules\.bin\firebase.cmd'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$FailureStateFile = Join-Path $Root 'last-deploy-failure.txt'
$LogFile = Join-Path $Root 'deploy.log'
$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$StatusPath = 'public/mockups/.deploy-status'
$MarkerPath = 'public/mockups/.deploy-ready'
$markerSha = 'unknown'
$stage = 'startup'

function Write-DeployLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line
}

function Publish-DeployStatus {
    param(
        [string]$Status,
        [string]$MarkerSha,
        [string]$Stage,
        [string]$Detail
    )

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return }

    $safeDetail = ($Detail -replace "`r|`n", ' ').Trim()
    if ($safeDetail.Length -gt 500) { $safeDetail = $safeDetail.Substring(0, 500) }

    $statusContent = @"
status=$Status
marker_sha=$MarkerSha
stage=$Stage
detail=$safeDetail
firebase_project=suhayb-manzar-portfolio
"@

    if ($Status -eq 'failure') {
        $failureSignature = "$MarkerSha|$Stage|$safeDetail"
        if (Test-Path $FailureStateFile) {
            $previousFailure = (Get-Content -Path $FailureStateFile -Raw).Trim()
            if ($previousFailure -eq $failureSignature) { return }
        }
        Set-Content -Path $FailureStateFile -Value $failureSignature -Encoding utf8
    }

    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($statusContent))
    $statusSha = (& gh api "repos/$Repo/contents/$StatusPath?ref=$([uri]::EscapeDataString($Branch))" --jq '.sha' 2>$null | Out-String).Trim()

    $message = if ($Status -eq 'success') { 'Record successful outreach deployment' } else { 'Record failed outreach deployment' }
    $args = @(
        'api', "repos/$Repo/contents/$StatusPath",
        '--method', 'PUT',
        '-f', "message=$message",
        '-f', "content=$encoded",
        '-f', "branch=$Branch"
    )
    if ($statusSha) { $args += @('-f', "sha=$statusSha") }

    & gh @args *> $null
}

try {
    $stage = 'preflight'
    if (-not (Test-Path $RepoDir)) { throw "Repository checkout not found at $RepoDir" }
    if (-not (Test-Path $FirebaseCmd)) { throw "npm Firebase CLI not found at $FirebaseCmd" }
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is not available.' }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not available.' }

    $stage = 'read_marker'
    $markerSha = (& gh api "repos/$Repo/contents/$MarkerPath?ref=$([uri]::EscapeDataString($Branch))" --jq '.sha').Trim()
    if (-not $markerSha) { throw 'Could not read the remote deployment marker.' }

    $lastDeployed = ''
    if (Test-Path $StateFile) { $lastDeployed = (Get-Content -Path $StateFile -Raw).Trim() }
    if ($markerSha -eq $lastDeployed) { exit 0 }

    Write-DeployLog "New deployment marker detected: $markerSha"

    $stage = 'sync_repository'
    & git -C $RepoDir fetch origin $Branch --prune
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
    & git -C $RepoDir checkout -B $Branch "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }
    & git -C $RepoDir reset --hard "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'git reset failed.' }
    & git -C $RepoDir clean -fd
    if ($LASTEXITCODE -ne 0) { throw 'git clean failed.' }

    $stage = 'firebase_deploy'
    Push-Location $RepoDir
    try {
        $firebaseOutput = (& $FirebaseCmd deploy --only hosting --project suhayb-manzar-portfolio --non-interactive 2>&1 | Out-String)
        if ($LASTEXITCODE -ne 0) {
            throw "Firebase Hosting deployment failed: $firebaseOutput"
        }
    }
    finally {
        Pop-Location
    }

    $stage = 'record_success'
    Set-Content -Path $StateFile -Value $markerSha -Encoding utf8
    if (Test-Path $FailureStateFile) { Remove-Item $FailureStateFile -Force -ErrorAction SilentlyContinue }
    Publish-DeployStatus -Status 'success' -MarkerSha $markerSha -Stage 'complete' -Detail 'Firebase Hosting deployment completed.'
    Write-DeployLog "Deployment succeeded for marker: $markerSha"
}
catch {
    $message = $_.Exception.Message
    Write-DeployLog "ERROR [$stage]: $message"
    try { Publish-DeployStatus -Status 'failure' -MarkerSha $markerSha -Stage $stage -Detail $message } catch {}
    exit 1
}
