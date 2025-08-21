@echo off
setlocal enabledelayedexpansion

if "%1"=="" (
    echo ❌ Error: Commit message is required
    echo Usage: release.bat "Your commit message" [version]
    echo Version options: patch, minor, major (default: patch)
    exit /b 1
)

set "MESSAGE=%1"
set "VERSION=%2"
if "%VERSION%"=="" set "VERSION=patch"

echo 🚀 Starting automated release process...
echo Message: %MESSAGE%
echo Version bump: %VERSION%
echo.

echo 📁 Step 1: Adding all changes to git...
git add .
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to add changes to git
    exit /b 1
)
echo ✅ Changes added successfully

echo 💾 Step 2: Committing changes...
git commit -m "%MESSAGE%"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to commit changes
    exit /b 1
)
echo ✅ Changes committed successfully

echo 📦 Step 3: Bumping npm version (%VERSION%)...
npm version %VERSION%
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to bump npm version
    exit /b 1
)
echo ✅ NPM version bumped successfully

echo 🚀 Step 4: Pushing to origin main with tags...
git push origin main --tags
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to push to origin main
    exit /b 1
)
echo ✅ Changes pushed successfully

echo.
echo 🎉 Release process completed successfully!
echo Your package is now ready for npm publish!
