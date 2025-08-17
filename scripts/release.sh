#!/bin/bash

# Release script for rag-cli-tester
set -e

echo "🚀 RAG CLI Tester Release Script"
echo "================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Error: Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Ask for release type
echo ""
echo "Select release type:"
echo "1) patch (bug fixes: $CURRENT_VERSION -> $(npm version --no-git-tag-version patch && git checkout package.json && npm version --no-git-tag-version patch --dry-run | cut -d' ' -f2))"
echo "2) minor (new features: $CURRENT_VERSION -> $(npm version --no-git-tag-version minor && git checkout package.json && npm version --no-git-tag-version minor --dry-run | cut -d' ' -f2))"
echo "3) major (breaking changes: $CURRENT_VERSION -> $(npm version --no-git-tag-version major && git checkout package.json && npm version --no-git-tag-version major --dry-run | cut -d' ' -f2))"
echo "4) Cancel"

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        RELEASE_TYPE="patch"
        ;;
    2)
        RELEASE_TYPE="minor"
        ;;
    3)
        RELEASE_TYPE="major"
        ;;
    4)
        echo "❌ Release cancelled"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🔨 Building package..."
npm run build

echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "📋 Checking package contents..."
npm pack --dry-run

echo ""
echo "📝 Creating $RELEASE_TYPE version..."
NEW_VERSION=$(npm version $RELEASE_TYPE)

echo ""
echo "✅ Version updated to: $NEW_VERSION"
echo ""
echo "🚀 Pushing to GitHub (this will trigger automated publishing)..."
git push origin main --tags

echo ""
echo "🎉 Release process initiated!"
echo "   - Version: $NEW_VERSION"
echo "   - GitHub Actions will now:"
echo "     ✅ Run tests"
echo "     ✅ Build package"
echo "     ✅ Publish to npm"
echo "     ✅ Create GitHub release"
echo ""
echo "🔍 Monitor progress at: https://github.com/yourusername/rag-cli-tester/actions"
echo ""
echo "📦 After publishing, users can update with:"
echo "   npm update -g rag-cli-tester"
