<#
.SYNOPSIS
    Convenience wrapper around `python tools\uad.py install`.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Target claude-code -Platforms unreal,web

.NOTES
    Everything this does can be done directly with the CLI.
    See docs/installation.md.
#>
[CmdletBinding()]
param(
    [string]$Target,
    [string[]]$Platforms
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$python = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $python) {
    Write-Error 'Python 3.9+ is required but was not found on PATH.'
    exit 1
}

$env:PYTHONIOENCODING = 'utf-8'
$version = & $python.Source -c 'import sys; print("%d.%d" % sys.version_info[:2])'
Write-Host "Using $($python.Source) (Python $version)"

if (-not $Target) {
    Write-Host ''
    Write-Host 'Which AI coding client are you installing for?'
    Write-Host '  1) claude-code     Claude Code (skills, agents, slash commands)'
    Write-Host '  2) codex           OpenAI Codex'
    Write-Host '  3) copilot         GitHub Copilot / VS Code'
    Write-Host '  4) cursor          Cursor'
    Write-Host '  5) generic         any Agent Skills client'
    $choice = Read-Host 'Choice [1]'
    if (-not $choice) { $choice = '1' }
    $Target = switch ($choice) {
        '1' { 'claude-code' }
        '2' { 'codex' }
        '3' { 'copilot' }
        '4' { 'cursor' }
        '5' { 'generic' }
        default { Write-Error 'Unrecognised choice'; exit 1 }
    }
}

if (-not $Platforms) {
    Write-Host ''
    Write-Host 'Which platforms do you work on? Core skills always install.'
    Write-Host 'Available: unreal unity godot roblox minecraft web'
    $entered = Read-Host 'Platforms (space separated, blank for all)'
    if ($entered) { $Platforms = $entered -split '\s+' }
}

Write-Host ''
& $python.Source tools\uad.py doctor

$installArgs = @('tools\uad.py', 'install', '--target', $Target)
if ($Platforms) { $installArgs += @('--platforms') + $Platforms }

# Show exactly what will be written before writing it.
Write-Host ''
& $python.Source @installArgs --dry-run | Select-Object -Last 6

$confirm = Read-Host 'Proceed? [Y/n]'
if ($confirm -match '^[nN]') {
    Write-Host 'Cancelled. Nothing was written.'
    exit 0
}

Write-Host ''
& $python.Source @installArgs

Write-Host ''
Write-Host 'Restart your AI client so it picks up the new skills.'
