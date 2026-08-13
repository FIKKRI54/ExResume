$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $projectRoot "dist/manifest.json"
$distPath = Join-Path $projectRoot "dist"
$releasePath = Join-Path $projectRoot "release"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Build output is missing. Run npm run build first."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
  throw "The packaged extension must use Manifest V3."
}

New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
$archivePath = Join-Path $releasePath ("exresume-{0}.zip" -f $manifest.version)

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $archivePath -CompressionLevel Optimal
$archive = Get-Item -LiteralPath $archivePath
Write-Output ("Packaged {0} ({1:N0} bytes)" -f $archive.FullName, $archive.Length)
