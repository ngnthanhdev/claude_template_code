<#
.SYNOPSIS
  Bootstraps a new project from this template: names the project, seeds
  docs/BRIEF.md (or docs/SPECIFICATIONS.md if you already have a spec), makes
  sure docs/specs/ stays empty (the Phase 0 hard gate depends on that), and
  optionally resets git history + creates a GitHub repo via `gh`.
#>

Write-Host "=== start-project ==="
Write-Host ""

$ProjectName = Read-Host "Project name"
if ([string]::IsNullOrWhiteSpace($ProjectName)) { $ProjectName = "my-project" }

$SpecPath = Read-Host "Path to an existing spec file, if you have one (leave blank to skip)"

$DocsDir = "docs"
$SpecsDir = Join-Path $DocsDir "specs"
New-Item -ItemType Directory -Force -Path $DocsDir | Out-Null
New-Item -ItemType Directory -Force -Path $SpecsDir | Out-Null

if ($SpecPath -and (Test-Path -LiteralPath $SpecPath -PathType Leaf)) {
    Copy-Item -LiteralPath $SpecPath -Destination (Join-Path $DocsDir "SPECIFICATIONS.md") -Force
    @"
# Brief

Project: $ProjectName

A full specification was supplied at bootstrap time and copied to
``docs/SPECIFICATIONS.md``. Run ``/phase-0`` to turn it into an approved
design in ``docs/specs/``.
"@ | Set-Content -Path (Join-Path $DocsDir "BRIEF.md")
    Write-Host "Copied $SpecPath -> $DocsDir/SPECIFICATIONS.md"
    Write-Host "Wrote $DocsDir/BRIEF.md"
} else {
    Write-Host ""
    Write-Host "No spec file provided. Give a quick brain-dump of the idea instead"
    Write-Host "(one line is fine -- Phase 0 will ask clarifying questions). End with"
    Write-Host "an empty line."
    $lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
        $line = Read-Host
        if ([string]::IsNullOrEmpty($line)) { break }
        $lines.Add($line) | Out-Null
    }
    if ($lines.Count -gt 0) {
        $BrainDump = [string]::Join([Environment]::NewLine, $lines)
    } else {
        $BrainDump = "_[fill in during Phase 0]_"
    }
    @"
# Brief

Project: $ProjectName

## The idea, in a few sentences

$BrainDump

## Who it's for

_[fill in during Phase 0]_

## Why it matters

_[fill in during Phase 0]_

## Rough scope

_[fill in during Phase 0]_

## Anything you already know you don't want

_[fill in during Phase 0]_

## Constraints

_[fill in during Phase 0]_

---

Run ``/phase-0`` to turn this into a PRD and an approved design in
``docs/specs/``.
"@ | Set-Content -Path (Join-Path $DocsDir "BRIEF.md")
    Write-Host "Wrote $DocsDir/BRIEF.md"
}

# Phase 0's hard gate depends on docs/specs/ being empty (only .gitkeep) --
# never let this script leave anything else there.
Get-ChildItem -Path $SpecsDir -Force | Where-Object { $_.Name -ne ".gitkeep" } | Remove-Item -Recurse -Force
if (-not (Test-Path (Join-Path $SpecsDir ".gitkeep"))) {
    New-Item -ItemType File -Force -Path (Join-Path $SpecsDir ".gitkeep") | Out-Null
}

Write-Host ""
Write-Host "docs/specs/ is empty (Phase 0 gate intact)."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  Open in Claude Code -> Phase 0 auto-starts via CLAUDE.md"

if (Get-Command gh -ErrorAction SilentlyContinue) {
    $answer = Read-Host "Reset git history and create a new GitHub repo for '$ProjectName' now? [y/N]"
    if ($answer -match '^(y|yes)$') {
        if (Test-Path ".git") { Remove-Item ".git" -Recurse -Force }
        git init
        git add -A
        git commit -m "chore: bootstrap $ProjectName from claude_template_code"
        gh repo create $ProjectName --source=. --private --push
        Write-Host "Created and pushed GitHub repo: $ProjectName"
    } else {
        Write-Host "Skipped git/GitHub setup."
    }
} else {
    Write-Host "(gh CLI not found -- skipping optional GitHub repo creation. Install"
    Write-Host " it from https://cli.github.com/ if you want this step automated.)"
}

Write-Host ""
Write-Host "Done."
