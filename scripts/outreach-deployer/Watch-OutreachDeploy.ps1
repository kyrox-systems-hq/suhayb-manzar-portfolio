$ErrorActionPreference = 'Stop'

$Root = Join-Path $env:LOCALAPPDATA 'Kyrox\outreach-deployer'
$RepoDir = Join-Path $Root 'repo'
$FirebaseCmd = Join-Path $Root 'firebase-cli\node_modules\.bin\firebase.cmd'
$StateFile = Join-Path $Root 'last-deployed-marker.txt'
$LogFile = Join-Path $Root 'deploy.log'
$Repo = 'kyrox-systems-hq/suhayb-manzar-portfolio'
$Branch = 'agent/weekly-outreach-system'
$MarkerPath = 'public/mockups/.deploy-ready'
$PollSeconds = 30

function Write-DeployLog {
    param([string]$Message)
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    Add-Content -LiteralPath $LogFile -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
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

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\KyroxOutreachAutoDeploy', [ref]$createdNew)
if (-not $createdNew) { exit 0 }

Write-DeployLog 'Watcher started.'

try {
    while ($true) {
        try {
            if (-not (Test-Path -LiteralPath $RepoDir)) { throw "Repository checkout missing at $RepoDir" }
            if (-not (Test-Path -LiteralPath $FirebaseCmd)) { throw "Firebase CLI missing at $FirebaseCmd" }

            $encodedBranch = [uri]::EscapeDataString($Branch)
            $marker = Invoke-Native -FilePath 'gh' -Arguments @('api',"repos/$Repo/contents/$MarkerPath?ref=$encodedBranch",'--jq','.sha')
            if ($marker.Code -ne 0) { throw "Could not read deployment marker: $($marker.Output)" }
            $markerSha = $marker.Output.Trim()
            if (-not $markerSha) { throw 'Deployment marker SHA was empty.' }

            $last = ''
            if (Test-Path -LiteralPath $StateFile) { $last = (Get-Content -LiteralPath $StateFile -Raw).Trim() }

            if ($markerSha -ne $last) {
                Write-DeployLog "New marker detected: $markerSha"

                foreach ($command in @(
                    @{File='git'; Args=@('-C',$RepoDir,'fetch','origin',$Branch,'--prune')},
                    @{File='git'; Args=@('-C',$RepoDir,'checkout','-B',$Branch,"origin/$Branch")},
                    @{File='git'; Args=@('-C',$RepoDir,'reset','--hard',"origin/$Branch")},
                    @{File='git'; Args=@('-C',$RepoDir,'clean','-fd')}
                )) {
                    $result = Invoke-Native -FilePath $command.File -Arguments $command.Args
                    if ($result.Code -ne 0) { throw "$($command.File) failed: $($result.Output)" }
                }

                Push-Location $RepoDir
                try {
                    $deploy = Invoke-Native -FilePath $FirebaseCmd -Arguments @('deploy','--only','hosting','--project','suhayb-manzar-portfolio','--non-interactive')
                } finally {
                    Pop-Location
                }
                if ($deploy.Code -ne 0) { throw "Firebase deploy failed: $($deploy.Output)" }

                Set-Content -LiteralPath $StateFile -Value $markerSha -Encoding utf8
                Write-DeployLog "Deployment succeeded: $markerSha"
            }
        } catch {
            Write-DeployLog "ERROR: $($_.Exception.Message)"
        }

        Start-Sleep -Seconds $PollSeconds
    }
} finally {
    try { $mutex.ReleaseMutex() } catch {}
    $mutex.Dispose()
}
