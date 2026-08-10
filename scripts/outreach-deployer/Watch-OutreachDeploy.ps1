$ErrorActionPreference = 'Stop'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseExe = Join-Path $Root 'firebase.exe'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'deploy.log'
$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$StatusPath = 'public/mockups/.deploy-status'

function Write-DeployLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line
}

function Publish-DeployStatus {
    param(
        [string]$MarkerSha,
        [string]$DeployedAtUtc
    )

    $statusContent = @"
status=success
marker_sha=$MarkerSha
deployed_at_utc=$DeployedAtUtc
firebase_project=suhayb-manzar-portfolio
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($statusContent))
    $statusSha = (& gh api "repos/$Repo/contents/$StatusPath?ref=$([uri]::EscapeDataString($Branch))" --jq '.sha' 2>$null | Out-String).Trim()

    $args = @(
        'api', "repos/$Repo/contents/$StatusPath",
        '--method', 'PUT',
        '-f', 'message=Record successful outreach deployment',
        '-f', "content=$encoded",
        '-f', "branch=$Branch"
    )
    if ($statusSha) {
        $args += @('-f', "sha=$statusSha")
    }

    & gh @args *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not publish deployment acknowledgement to GitHub.'
    }
}

try {
    if (-not (Test-Path $RepoDir)) { throw "Repository checkout not found at $RepoDir" }
    if (-not (Test-Path $FirebaseExe)) { throw "Firebase CLI not found at $FirebaseExe" }
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is not available.' }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not available.' }

    $markerSha = (& gh api "repos/$Repo/contents/public/mockups/.deploy-ready?ref=$([uri]::EscapeDataString($Branch))" --jq '.sha').Trim()
    if (-not $markerSha) { throw 'Could not read the remote deployment marker.' }

    $lastDeployed = ''
    if (Test-Path $StateFile) {
        $lastDeployed = (Get-Content -Path $StateFile -Raw).Trim()
    }

    if ($markerSha -eq $lastDeployed) {
        exit 0
    }

    Write-DeployLog "New deployment marker detected: $markerSha"

    & git -C $RepoDir fetch origin $Branch --prune
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

    & git -C $RepoDir checkout -B $Branch "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }

    & git -C $RepoDir reset --hard "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { throw 'git reset failed.' }

    & git -C $RepoDir clean -fd
    if ($LASTEXITCODE -ne 0) { throw 'git clean failed.' }

    Push-Location $RepoDir
    try {
        & $FirebaseExe deploy --only hosting --project suhayb-manzar-portfolio --non-interactive
        if ($LASTEXITCODE -ne 0) { throw 'Firebase Hosting deployment failed.' }
    }
    finally {
        Pop-Location
    }

    $deployedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    Set-Content -Path $StateFile -Value $markerSha -Encoding utf8
    Publish-DeployStatus -MarkerSha $markerSha -DeployedAtUtc $deployedAtUtc
    Write-DeployLog "Deployment succeeded for marker: $markerSha"
}
catch {
    Write-DeployLog "ERROR: $($_.Exception.Message)"
    exit 1
}
