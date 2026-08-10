$ErrorActionPreference = 'Stop'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseExe = Join-Path $Root 'firebase.exe'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'deploy.log'
$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'

function Write-DeployLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line
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

    Set-Content -Path $StateFile -Value $markerSha -Encoding utf8
    Write-DeployLog "Deployment succeeded for marker: $markerSha"
}
catch {
    Write-DeployLog "ERROR: $($_.Exception.Message)"
    exit 1
}
