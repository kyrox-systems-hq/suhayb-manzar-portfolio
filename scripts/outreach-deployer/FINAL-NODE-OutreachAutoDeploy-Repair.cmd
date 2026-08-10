@echo off
setlocal EnableExtensions
title Kyrox Outreach Auto Deploy - FINAL NODE REPAIR

set "REPO=kyrox-systems-hq/suhayb-manzar-portfolio"
set "BRANCH=agent/weekly-outreach-system"
set "BOOT=%TEMP%\KyroxOutreachBootstrap-%RANDOM%-%RANDOM%"
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\nodejs"

echo.
echo Kyrox Outreach Auto Deploy - final Node repair
echo ===============================================
echo.

echo [bootstrap 1/5] Checking Git...
call :ensure git.exe Git.Git "C:\Program Files\Git\cmd"
if errorlevel 1 goto :bootstrap_failed

echo [bootstrap 2/5] Checking GitHub CLI...
call :ensure gh.exe GitHub.cli "C:\Program Files\GitHub CLI"
if errorlevel 1 goto :bootstrap_failed

echo [bootstrap 3/5] Checking Node.js...
call :ensure node.exe OpenJS.NodeJS.LTS "C:\Program Files\nodejs"
if errorlevel 1 goto :bootstrap_failed

where npm.cmd >nul 2>&1
if errorlevel 1 goto :npm_missing

echo [bootstrap 4/5] Validating GitHub sign-in...
gh auth status --hostname github.com >nul 2>&1
if errorlevel 1 goto :github_login

goto :github_repo_check

:github_login
echo GitHub needs one browser sign-in.
gh auth login --hostname github.com --git-protocol https --web
if errorlevel 1 goto :github_failed

:github_repo_check
gh repo view "%REPO%" --json nameWithOwner >nul 2>&1
if errorlevel 1 goto :github_refresh

goto :github_ready

:github_refresh
echo Refreshing GitHub repository permission...
gh auth refresh --hostname github.com --scopes repo
if errorlevel 1 goto :github_failed

gh repo view "%REPO%" --json nameWithOwner >nul 2>&1
if errorlevel 1 goto :github_failed

:github_ready
gh auth setup-git --hostname github.com >nul 2>&1
if errorlevel 1 goto :github_failed

echo [bootstrap 5/5] Loading the validated installer from the repository...
if exist "%BOOT%" rmdir /s /q "%BOOT%"
gh repo clone "%REPO%" "%BOOT%" -- --branch "%BRANCH%" --single-branch
if errorlevel 1 goto :clone_failed

if not exist "%BOOT%\scripts\outreach-deployer\Install-OutreachAutoDeploy.js" goto :installer_missing

node "%BOOT%\scripts\outreach-deployer\Install-OutreachAutoDeploy.js"
set "RESULT=%ERRORLEVEL%"

if exist "%BOOT%" rmdir /s /q "%BOOT%"

if not "%RESULT%"=="0" goto :installer_failed

echo.
echo FINAL NODE REPAIR COMPLETED SUCCESSFULLY.
echo The installer itself has already performed the live deployment and cleanup self-test.
echo.
pause
exit /b 0

:npm_missing
echo.
echo npm.cmd is missing after Node.js setup.
echo Restart Windows once and run this same file again.
goto :failed

:github_failed
echo.
echo GitHub authentication or repository access failed.
goto :failed

:clone_failed
echo.
echo Could not clone the outreach branch from GitHub.
goto :failed

:installer_missing
echo.
echo The validated Node installer was not found in the cloned branch.
goto :failed

:installer_failed
echo.
echo The Node installer reported a real failure above.
echo Do not rerun blindly. Leave this window open.
goto :failed_no_cleanup

:bootstrap_failed
echo.
echo A required Windows prerequisite could not be installed or found.
goto :failed

:failed
if exist "%BOOT%" rmdir /s /q "%BOOT%"

:failed_no_cleanup
echo.
echo FINAL NODE REPAIR FAILED.
echo.
pause
exit /b 1

:ensure
where %~1 >nul 2>&1
if not errorlevel 1 exit /b 0

where winget.exe >nul 2>&1
if errorlevel 1 goto :ensure_no_winget

echo Installing %~2...
winget install --id %~2 -e --source winget --accept-package-agreements --accept-source-agreements --silent
if errorlevel 1 goto :ensure_install_failed

set "PATH=%PATH%;%~3"
where %~1 >nul 2>&1
if errorlevel 1 goto :ensure_restart
exit /b 0

:ensure_no_winget
echo Windows Package Manager is unavailable, so %~2 could not be installed automatically.
exit /b 1

:ensure_install_failed
echo winget failed while installing %~2.
exit /b 1

:ensure_restart
echo %~2 was installed but is not yet visible in this Command Prompt.
echo Restart Windows once and run this same repair again.
exit /b 1
