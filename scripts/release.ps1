#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("patch", "minor", "major")]
    [string]$Version = "patch"
)

Write-Host "🚀 Starting automated release process..." -ForegroundColor Green
Write-Host "Message: $Message" -ForegroundColor Cyan
Write-Host "Version bump: $Version" -ForegroundColor Cyan
Write-Host ""

# Step 1: Git add all changes
Write-Host "📁 Step 1: Adding all changes to git..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to add changes to git" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Changes added successfully" -ForegroundColor Green

# Step 2: Git commit with message
Write-Host "💾 Step 2: Committing changes..." -ForegroundColor Yellow
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to commit changes" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Changes committed successfully" -ForegroundColor Green

# Step 3: NPM version bump
Write-Host "📦 Step 3: Bumping npm version ($Version)..." -ForegroundColor Yellow
npm version $Version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to bump npm version" -ForegroundColor Red
    exit 1
}
Write-Host "✅ NPM version bumped successfully" -ForegroundColor Green

# Step 4: Git push with tags
Write-Host "🚀 Step 4: Pushing to origin main with tags..." -ForegroundColor Yellow
git push origin main --tags
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push to origin main" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Changes pushed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Release process completed successfully!" -ForegroundColor Green
Write-Host "Your package is now ready for npm publish!" -ForegroundColor Cyan
