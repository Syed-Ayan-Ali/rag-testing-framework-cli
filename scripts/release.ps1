# Release script for rag-cli-tester (PowerShell)
param(
    [Parameter()]
    [ValidateSet("patch", "minor", "major")]
    [string]$ReleaseType
)

Write-Host "🚀 RAG CLI Tester Release Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if we're in a git repository
try {
    git rev-parse --git-dir | Out-Null
} catch {
    Write-Host "❌ Error: Not in a git repository" -ForegroundColor Red
    exit 1
}

# Check if working directory is clean
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Error: Working directory is not clean. Please commit or stash changes." -ForegroundColor Red
    git status --short
    exit 1
}

# Get current version
$currentVersion = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "📦 Current version: $currentVersion" -ForegroundColor Yellow

if (-not $ReleaseType) {
    # Ask for release type
    Write-Host ""
    Write-Host "Select release type:"
    Write-Host "1) patch (bug fixes)"
    Write-Host "2) minor (new features)"
    Write-Host "3) major (breaking changes)"
    Write-Host "4) Cancel"
    
    $choice = Read-Host "Enter choice (1-4)"
    
    switch ($choice) {
        "1" { $ReleaseType = "patch" }
        "2" { $ReleaseType = "minor" }
        "3" { $ReleaseType = "major" }
        "4" { 
            Write-Host "❌ Release cancelled" -ForegroundColor Red
            exit 0 
        }
        default { 
            Write-Host "❌ Invalid choice" -ForegroundColor Red
            exit 1 
        }
    }
}

Write-Host ""
Write-Host "🔨 Building package..." -ForegroundColor Blue
npm run build

Write-Host ""
Write-Host "🧪 Running tests..." -ForegroundColor Blue
npm test

Write-Host ""
Write-Host "📋 Checking package contents..." -ForegroundColor Blue
npm pack --dry-run

Write-Host ""
Write-Host "📝 Creating $ReleaseType version..." -ForegroundColor Blue
$newVersion = npm version $ReleaseType

Write-Host ""
Write-Host "✅ Version updated to: $newVersion" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Pushing to GitHub (this will trigger automated publishing)..." -ForegroundColor Blue
git push origin main --tags

Write-Host ""
Write-Host "🎉 Release process initiated!" -ForegroundColor Green
Write-Host "   - Version: $newVersion" -ForegroundColor White
Write-Host "   - GitHub Actions will now:" -ForegroundColor White
Write-Host "     ✅ Run tests" -ForegroundColor Green
Write-Host "     ✅ Build package" -ForegroundColor Green
Write-Host "     ✅ Publish to npm" -ForegroundColor Green
Write-Host "     ✅ Create GitHub release" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Monitor progress at: https://github.com/yourusername/rag-cli-tester/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 After publishing, users can update with:" -ForegroundColor Yellow
Write-Host "   npm update -g rag-cli-tester" -ForegroundColor White
