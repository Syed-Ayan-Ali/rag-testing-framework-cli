# Development & Publishing Guide

## 🔄 Development Workflow

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/rag-cli-tester.git
cd rag-cli-tester

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link
```

### Making Changes
```bash
# Make your changes to src/ files
# Build and test locally
npm run build
npm link  # Test globally

# Test the CLI
rag-test --help
rag-test configure
```

## 🚀 Publishing Workflow

### Method 1: Automated via Git Tags (Recommended)
```bash
# Make your changes and commit
git add .
git commit -m "feat: add new feature"

# Update version and create tag
npm version patch  # for bug fixes (1.0.0 -> 1.0.1)
npm version minor  # for new features (1.0.0 -> 1.1.0)  
npm version major  # for breaking changes (1.0.0 -> 2.0.0)

# Push with tags (triggers GitHub Actions)
git push origin main --tags
```

This will automatically:
- ✅ Run tests
- ✅ Build the package
- ✅ Publish to npm
- ✅ Create GitHub release

### Method 2: Manual Publishing
```bash
# Build first
npm run build

# Publish manually
npm publish
```

### Method 3: GitHub Release (GUI)
1. Go to GitHub repository
2. Click "Create a new release"
3. Create a new tag (e.g., `v1.0.1`)
4. Add release notes
5. Publish release

This triggers the automated workflow.

## 📋 Pre-Publishing Checklist

- [ ] All changes committed and pushed
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated (if applicable)
- [ ] README.md updated for new features
- [ ] Local testing completed (`npm link`)
- [ ] Build succeeds (`npm run build`)
- [ ] No sensitive data in files

## 🔧 GitHub Actions Setup

### Required Secrets
Add these to your GitHub repository secrets:

1. **NPM_TOKEN**: 
   - Go to npmjs.com → Account → Access Tokens
   - Create "Automation" token
   - Add to GitHub: Settings → Secrets → Actions → New repository secret

2. **GITHUB_TOKEN**: 
   - Automatically provided by GitHub
   - No setup needed

### Workflow Triggers
The automated publishing triggers on:
- ✅ Git tags starting with `v` (e.g., `v1.0.1`)
- ✅ GitHub releases
- ✅ Push to main branch
- ✅ Manual workflow dispatch

## 📊 Version Strategy

### Semantic Versioning (semver)
- **PATCH** (`1.0.1`): Bug fixes, no breaking changes
- **MINOR** (`1.1.0`): New features, no breaking changes  
- **MAJOR** (`2.0.0`): Breaking changes

### Examples
```bash
# Bug fix: fix .env loading issue
npm version patch
git push origin main --tags

# New feature: add new metric type
npm version minor  
git push origin main --tags

# Breaking change: change CLI command structure
npm version major
git push origin main --tags
```

## 🧪 Testing Locally

### Test the CLI Package
```bash
# Build and link
npm run build
npm link

# Test commands
rag-test --help
rag-test configure
rag-test tables

# Unlink when done
npm unlink -g
```

### Test in Another Project
```bash
# In your other project directory
npm install -g file:../path/to/rag-cli-tester
rag-test --help
```

## 🔍 Debugging

### Common Issues
1. **"Command not found"**: Run `npm link` again
2. **"Module not found"**: Check if build succeeded (`npm run build`)
3. **"Permission denied"**: Use `sudo npm link` on Unix systems

### Check Package Contents
```bash
# See what will be published
npm pack --dry-run

# Create actual package file
npm pack
```

## 📁 File Structure

```
rag-cli-tester/
├── .github/
│   └── workflows/          # GitHub Actions
├── src/                    # TypeScript source
├── dist/                   # Compiled JavaScript (git ignored)
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript config
├── .gitignore            # Git ignore patterns
├── .npmignore            # npm ignore patterns
└── README.md             # Documentation
```

## 🎯 Release Checklist

Before creating a release:
- [ ] Test locally with `npm link`
- [ ] Update version with `npm version`
- [ ] Update README if needed
- [ ] Create git tag and push
- [ ] Verify GitHub Actions succeeded
- [ ] Test installation: `npm install -g rag-cli-tester`
- [ ] Verify on npmjs.com that package is published

## 🚨 Emergency Procedures

### Unpublish (within 24 hours)
```bash
npm unpublish rag-cli-tester@1.0.1
```

### Deprecate a Version
```bash
npm deprecate rag-cli-tester@1.0.1 "This version has critical bugs"
```

### Hotfix Workflow
```bash
# Create hotfix branch
git checkout -b hotfix/critical-fix

# Make fix and test
git commit -m "fix: critical security issue"

# Patch version and publish immediately
npm version patch
git push origin hotfix/critical-fix --tags

# Merge back to main
git checkout main
git merge hotfix/critical-fix
git push origin main
```
