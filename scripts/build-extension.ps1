Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'

# Build stamp: package version + short git SHA + UTC timestamp.
# Injected into popup.html + comparison.html so the user can visually
# confirm which build is loaded in Chrome/Edge/Firefox.
$pkgVersion = (Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).version
try {
  $shortSha = (& git -C $root rev-parse --short HEAD 2>$null).Trim()
  if (-not $shortSha) { $shortSha = 'nogit' }
} catch { $shortSha = 'nogit' }
$buildStamp = "v$pkgVersion.$shortSha"

# Flat files copied into each browser dist as-is.
$runtimeFiles = @(
  'ai-provider-guide.html',
  'ai-provider-guide.css',
  'ai-provider-guide.js',
  'ai-dev-monitor.js',
  'ai-ui.js',
  'ai-providers.js',
  'ai-select.html',
  'ai-select.css',
  'ai-select.js',
  'background.js',
  'comparison.html',
  'comparison.css',
  'comparison.js',
  'comparison-feedback.js',
  'content.js',
  'NOTICE',
  'popup.html',
  'popup.css',
  'popup.js',
  'settings.html',
  'settings.css',
  'settings.js',
  'theme.css',
  'utils.js'
)

# Directories copied recursively into each dist (state/data/ui layers + vendor libs + icons + layered extraction pipeline).
$runtimeDirs = @('state', 'data', 'normalization', 'shared', 'ui', 'security', 'vendor', 'icons', 'logos', 'content', 'comparison', 'grid-rebuild-codex', 'ribbon')
# SlickGrid removed in Phase 5 cleanup — every grid (products, compare
# matrix, normalization review, user rules) renders through AG Grid now.

$targets = @(
  @{ Name = 'chrome';  Manifest = 'manifest.json' },
  @{ Name = 'edge';    Manifest = 'manifest.json' },
  @{ Name = 'firefox'; Manifest = 'manifest.firefox.json' }
)

# Patterns to strip from the copied dist. Recursive copies of runtime dirs
# pull in developer-only files (tests, READMEs, SCHEMA.md) that are not
# referenced by any manifest, HTML page, or runtime script and should not
# ship in the extension package. BUILD_MANIFEST.json IS kept because it
# carries source fingerprints and generator provenance for the generated
# libraries.
$distExcludeFilePatterns = @('*.test.js', 'README.md', 'SCHEMA.md')
$distExcludeDirNames     = @('tests')

New-Item -ItemType Directory -Force -Path $dist | Out-Null

foreach ($target in $targets) {
  $outDir = Join-Path $dist $target.Name
  if (Test-Path $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  foreach ($file in $runtimeFiles) {
    $src = Join-Path $root $file
    if (-not (Test-Path $src)) {
      Write-Warning "missing source file: $file"
      continue
    }
    Copy-Item -LiteralPath $src -Destination (Join-Path $outDir $file)
  }

  foreach ($dir in $runtimeDirs) {
    $src = Join-Path $root $dir
    if (-not (Test-Path $src)) {
      Write-Warning "missing source directory: $dir"
      continue
    }
    Copy-Item -LiteralPath $src -Destination (Join-Path $outDir $dir) -Recurse
  }

  Copy-Item -LiteralPath (Join-Path $root $target.Manifest) -Destination (Join-Path $outDir 'manifest.json')

  # Strip developer-only files (tests, READMEs, contract docs) from the
  # copied dist. These come along for the ride when the runtime dirs are
  # copied recursively but are not runtime-referenced.
  foreach ($dirName in $distExcludeDirNames) {
    Get-ChildItem -LiteralPath $outDir -Directory -Recurse -Force |
      Where-Object { $_.Name -eq $dirName } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
  }
  foreach ($pattern in $distExcludeFilePatterns) {
    Get-ChildItem -LiteralPath $outDir -File -Recurse -Force -Filter $pattern |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  }

  # Stamp the build tag into every HTML file that contains the placeholder
  # `data-build-tag>dev`. Any file whose header includes that marker gets
  # the current version+SHA, so the user can visually verify the loaded
  # build in Chrome/Edge/Firefox.
  foreach ($htmlName in @('popup.html', 'comparison.html')) {
    $htmlPath = Join-Path $outDir $htmlName
    if (Test-Path -LiteralPath $htmlPath) {
      $content = Get-Content -Raw -LiteralPath $htmlPath
      $stamped = $content.Replace('data-build-tag>dev<', "data-build-tag>$buildStamp<")
      if ($stamped -ne $content) {
        Set-Content -LiteralPath $htmlPath -Value $stamped -NoNewline -Encoding utf8
      }
    }
  }

  Write-Host "Built $($target.Name) extension at $outDir ($buildStamp)"
}
