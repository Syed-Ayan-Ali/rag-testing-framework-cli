# Release Scripts

This directory contains automated release scripts for the RAG CLI Tester package.

## 🚀 Quick Release Commands

### Using npm scripts (Recommended)
```bash
# Release with patch version (bug fixes)
npm run release:patch

# Release with minor version (new features)
npm run release:minor

# Release with major version (breaking changes)
npm run release:major

# Custom release with custom message
npm run release -- "Your custom commit message" [patch|minor|major]
```

### Using PowerShell script directly
```powershell
# Release with patch version
.\scripts\release.ps1 "Bug fixes and improvements" patch

# Release with minor version
.\scripts\release.ps1 "New features added" minor

# Release with major version
.\scripts\release.ps1 "Breaking changes" major
```

### Using Windows batch file
```cmd
# Release with patch version
scripts\release.bat "Bug fixes and improvements" patch

# Release with minor version
scripts\release.bat "New features added" minor

# Release with major version
scripts\release.bat "Breaking changes" major
```

## 📋 What the Scripts Do

1. **Git Add**: `git add .` - Stages all changes
2. **Git Commit**: `git commit -m "message"` - Commits with your message
3. **NPM Version**: `npm version [patch|minor|major]` - Bumps package version
4. **Git Push**: `git push origin main --tags` - Pushes changes and tags

## 🔄 Version Bumping

- **patch**: Bug fixes (1.0.0 → 1.0.1)
- **minor**: New features (1.0.0 → 1.1.0)
- **major**: Breaking changes (1.0.0 → 2.0.0)

## 🎯 Example Workflow

```bash
# 1. Make your changes
# 2. Test everything works
npm run test:all

# 3. Release with appropriate version
npm run release:patch

# 4. GitHub Actions will automatically:
#    - Run tests
#    - Build package
#    - Publish to npm
#    - Create GitHub release
```

## ⚠️ Prerequisites

- Git repository initialized
- Remote origin set to GitHub
- GitHub Actions workflow configured
- npm publish permissions
