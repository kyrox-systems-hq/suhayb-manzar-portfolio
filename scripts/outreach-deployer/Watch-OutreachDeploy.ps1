$ErrorActionPreference = 'Stop'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCliDir = Join-Path $Root 'firebase-cli'
$FirebaseCmd = Join-Path $FirebaseCliDir 'node_modules\.bin\firebase.cmd'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'deploy.log'

$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$ProjectId = 'suhayb-manzar-portfolio'
$MarkerPath = 'public/mockups/.deploy-ready'
$StatusPath = 'public/mockups/.deploy-status'
$HostingRoot = 'https://suhayb-manzar-portfolio.web.app'

$stage = 'startup'
$markerSha = 'unknown'
$markerText = ''

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Write-DeployLog {
    param([string]$Message)
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
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

function Publish-DeployStatus {
    param(
        [string]$Status,
        [string]$MarkerSha,
        [string]$Stage,
        [string]$Detail,
        [string]$LiveUrl = ''
    )

    $safeDetail = (($Detail -replace "`r|`n", ' ') -replace '\s+', ' ').Trim()
    if ($safeDetail.Length -gt 700) {
        $safeDetail = $safeDetail.Substring(0, 700)
    }

    $statusContent = @"
status=$Status
marker_sha=$MarkerSha
stage=$Stage
deployed_at_utc=$((Get-Date).ToUniversalTime().ToString('o'))
firebase_project=$ProjectId
live_url=$LiveUrl
detail=$safeDetail
"@

    $encodedContent = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($statusContent))
    $existing = Get-RemoteFile -Path $StatusPath

    $arguments = @(
        'api',
        "repos/$Repo/contents/$StatusPath",
        '--method', 'PUT',
        '-f', "message=Record outreach deployment $Status",
        '-f', "content=$encodedContent",
        '-f', "branch=$Branch"
    )

    if ($null -ne $existing -and $existing.sha) {
        $arguments += @('-f', "sha=$($existing.sha)")
    }

    $result = Invoke-Native -FilePath 'gh' -Arguments $arguments
    if ($result.Code -ne 0) {
        throw "Could not publish deployment status: $($result.Output)"
    }
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
        throw "Expected text '$RequiredText' was not found at $Url"
    }

    if ($RequireNoIndex) {
        $robots = [string]$response.Headers['X-Robots-Tag']
        if ($robots -notmatch 'noindex') {
            throw "X-Robots-Tag noindex was not present at $Url"
        }
    }

    return $response
}

try {
    Refresh-Path
    New-Item -ItemType Directory -Path $Root -Force | Out-Null

    $stage = 'preflight'
    foreach ($command in @('git', 'gh', 'node')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "$command is not available in PATH."
        }
    }
    if (-not (Test-Path -LiteralPath $RepoDir)) {
        throw "Repository checkout not found at $RepoDir"
    }
    if (-not (Test-Path -LiteralPath $FirebaseCmd)) {
        throw "Firebase CLI not found at $FirebaseCmd"
    }

    $stage = 'read_marker'
    $markerFile = Get-RemoteFile -Path $MarkerPath
    if ($null -eq $markerFile -or -not $markerFile.sha) {
        throw 'Could not read the remote deployment marker.'
    }

    $markerSha = [string]$markerFile.sha
    $markerText = Decode-GitHubContent -FileObject $markerFile

    $lastDeployed = ''
    if (Test-Path -LiteralPath $StateFile) {
        $lastDeployed = (Get-Content -LiteralPath $StateFile -Raw).Trim()
    }

    if ($markerSha -eq $lastDeployed) {
        exit 0
    }

    Write-DeployLog "New deployment marker detected: $markerSha"

    $stage = 'sync_repository'
    foreach ($gitArgs in @(
        @('-C', $RepoDir, 'fetch', 'origin', $Branch, '--prune'),
        @('-C', $RepoDir, 'checkout', '-B', $Branch, "origin/$Branch"),
        @('-C', $RepoDir, 'reset', '--hard', "origin/$Branch"),
        @('-C', $RepoDir, 'clean', '-fd')
    )) {
        $result = Invoke-Native -FilePath 'git' -Arguments $gitArgs
        if ($result.Code -ne 0) {
            throw "Git command failed: $($gitArgs -join ' ') :: $($result.Output)"
        }
    }

    $stage = 'firebase_deploy'
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
        throw "Firebase Hosting deployment failed: $($deploy.Output)"
    }

    $stage = 'verify_live'
    Assert-WebPage -Url "$HostingRoot/" | Out-Null

    $slug = ''
    foreach ($line in ($markerText -split '\r?\n')) {
        if ($line -match '^slug=(.+)$') {
            $slug = $Matches[1].Trim()
            break
        }
    }

    $liveUrl = "$HostingRoot/"
    if ($slug) {
        $liveUrl = "$HostingRoot/mockups/$slug/"
        Assert-WebPage -Url $liveUrl -RequireNoIndex | Out-Null
    }

    $stage = 'record_success'
    Publish-DeployStatus -Status 'success' -MarkerSha $markerSha -Stage 'complete' -Detail 'Firebase Hosting deployment and live HTTP verification passed.' -LiveUrl $liveUrl
    Set-Content -LiteralPath $StateFile -Value $markerSha -Encoding UTF8
    Write-DeployLog "Deployment succeeded for marker: $markerSha"
    exit 0
}
catch {
    $message = $_.Exception.Message
    Write-DeployLog "ERROR [$stage]: $message"
    try {
        Publish-DeployStatus -Status 'failure' -MarkerSha $markerSha -Stage $stage -Detail $message
    }
    catch {
        Write-DeployLog "Could not publish failure status: $($_.Exception.Message)"
    }
    exit 1
}
