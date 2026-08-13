$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distPath = Join-Path $projectRoot "dist"
$manifestPath = Join-Path $distPath "manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Host "The release build is missing. Building it now..." -ForegroundColor Yellow
  Push-Location $projectRoot
  try { & npm.cmd run build } finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "ExResume could not be built. See the error above."
}

$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chromePath = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chromePath) { throw "Google Chrome was not found on this computer." }

Set-Clipboard -Value $distPath
Start-Process -FilePath "explorer.exe" -ArgumentList "/select,`"$manifestPath`""
Start-Process -FilePath $chromePath -ArgumentList "chrome://extensions"

Write-Host ""
Write-Host "ExResume 1.2 is built and ready." -ForegroundColor Green
Write-Host ""
Write-Host "Chrome requires one manual approval for local extensions:" -ForegroundColor White
Write-Host "  1. Turn on Developer mode in the Chrome page that just opened."
Write-Host "  2. Click Load unpacked."
Write-Host "  3. Paste this already-copied folder path into the folder box:"
Write-Host ""
Write-Host "     $distPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Click Select Folder, then pin ExResume from Chrome's puzzle menu."
Write-Host ""
Write-Host "The release folder is also open in Explorer."
