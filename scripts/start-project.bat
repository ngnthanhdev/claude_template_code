@echo off
setlocal enabledelayedexpansion
echo === start-project ===
echo.

set /p PROJECT_NAME=Project name:
if "%PROJECT_NAME%"=="" set PROJECT_NAME=my-project

set /p SPEC_PATH=Path to an existing spec file, if you have one (leave blank to skip):

set "DOCS_DIR=docs"
set "SPECS_DIR=%DOCS_DIR%\specs"
if not exist "%DOCS_DIR%" mkdir "%DOCS_DIR%"
if not exist "%SPECS_DIR%" mkdir "%SPECS_DIR%"

set "HAVE_SPEC=0"
if not "%SPEC_PATH%"=="" if exist "%SPEC_PATH%" set "HAVE_SPEC=1"

if "%HAVE_SPEC%"=="1" (
  copy /y "%SPEC_PATH%" "%DOCS_DIR%\SPECIFICATIONS.md" >nul
  (
    echo # Brief
    echo.
    echo Project: %PROJECT_NAME%
    echo.
    echo A full specification was supplied at bootstrap time and copied to
    echo `docs/SPECIFICATIONS.md`. Run `/phase-0` to turn it into an approved
    echo design in `docs/specs/`.
  ) > "%DOCS_DIR%\BRIEF.md"
  echo Copied %SPEC_PATH% -^> %DOCS_DIR%\SPECIFICATIONS.md
  echo Wrote %DOCS_DIR%\BRIEF.md
) else (
  echo.
  echo No spec file provided. Give a quick brain-dump of the idea instead
  echo (one line is fine -- Phase 0 will ask clarifying questions^). End with
  echo an empty line.
  set "BRAINDUMP_FILE=%TEMP%\start-project-braindump.txt"
  if exist "!BRAINDUMP_FILE!" del /q "!BRAINDUMP_FILE!"
  :brainloop
  set "LINE="
  set /p LINE=
  if "!LINE!"=="" goto brainloopdone
  echo !LINE!>> "!BRAINDUMP_FILE!"
  goto brainloop
  :brainloopdone
  (
    echo # Brief
    echo.
    echo Project: %PROJECT_NAME%
    echo.
    echo ## The idea, in a few sentences
    echo.
    if exist "!BRAINDUMP_FILE!" (
      type "!BRAINDUMP_FILE!"
    ) else (
      echo _[fill in during Phase 0]_
    )
    echo.
    echo ## Who it's for
    echo.
    echo _[fill in during Phase 0]_
    echo.
    echo ## Why it matters
    echo.
    echo _[fill in during Phase 0]_
    echo.
    echo ## Rough scope
    echo.
    echo _[fill in during Phase 0]_
    echo.
    echo ## Anything you already know you don't want
    echo.
    echo _[fill in during Phase 0]_
    echo.
    echo ## Constraints
    echo.
    echo _[fill in during Phase 0]_
    echo.
    echo ---
    echo.
    echo Run `/phase-0` to turn this into a PRD and an approved design in
    echo `docs/specs/`.
  ) > "%DOCS_DIR%\BRIEF.md"
  if exist "!BRAINDUMP_FILE!" del /q "!BRAINDUMP_FILE!"
  echo Wrote %DOCS_DIR%\BRIEF.md
)

rem Phase 0's hard gate depends on docs/specs/ being empty (only .gitkeep) --
rem never let this script leave anything else there.
for %%F in ("%SPECS_DIR%\*") do (
  if /I not "%%~nxF"==".gitkeep" del /q "%%F"
)
if not exist "%SPECS_DIR%\.gitkeep" type nul > "%SPECS_DIR%\.gitkeep"

echo.
echo docs/specs/ is empty (Phase 0 gate intact).
echo.
echo Next steps:
echo   Open in Claude Code -^> Phase 0 auto-starts via CLAUDE.md

where gh >nul 2>nul
if %ERRORLEVEL%==0 (
  set /p ANSWER=Reset git history and create a new GitHub repo for '%PROJECT_NAME%' now? [y/N]:
  if /I "!ANSWER!"=="y" (
    if exist ".git" rmdir /s /q ".git"
    git init
    git add -A
    git commit -m "chore: bootstrap %PROJECT_NAME% from claude_template_code"
    gh repo create %PROJECT_NAME% --source=. --private --push
    echo Created and pushed GitHub repo: %PROJECT_NAME%
  ) else (
    echo Skipped git/GitHub setup.
  )
) else (
  echo ^(gh CLI not found -- skipping optional GitHub repo creation. Install
  echo  it from https://cli.github.com/ if you want this step automated.^)
)

echo.
echo Done.
endlocal
