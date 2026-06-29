Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'

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
  'popup.html',
  'popup.css',
  'popup.js',
  'settings.html',
  'settings.css',
  'settings.js',
  'theme.css',
  'utils.js',
  'shopscout-about.md'
)

# Directories copied recursively into each dist (state/data/ui layers + vendor libs + icons + layered extraction pipeline).
$runtimeDirs = @('state', 'data', 'shared', 'ui', 'security', 'vendor', 'icons', 'content', 'comparison', 'grid-rebuild-codex')

$targets = @(
  @{ Name = 'chrome';  Manifest = 'manifest.json' },
  @{ Name = 'edge';    Manifest = 'manifest.json' },
  @{ Name = 'firefox'; Manifest = 'manifest.firefox.json' }
)

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

  Write-Host "Built $($target.Name) extension at $outDir"
}
