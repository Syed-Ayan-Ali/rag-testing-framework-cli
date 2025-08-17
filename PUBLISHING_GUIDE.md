# Publishing Guide for RAG CLI Tester

## Step-by-Step Publishing Instructions

### 1. Prepare for Publishing

Before publishing to npm, ensure everything is ready:

```bash
# Make sure you're in the rag-cli-tester directory
cd rag-cli-tester

# Build the package
npm run build

# Test the package locally
npm link
rag-test --help
```

### 2. Create npm Account (if needed)

If you don't have an npm account:
1. Go to https://www.npmjs.com/signup
2. Create an account
3. Verify your email

### 3. Login to npm

```bash
npm login
```

Enter your npm username, password, and email when prompted.

### 4. Check Package Name Availability

```bash
npm search rag-cli-tester
```

If the name is taken, update the name in `package.json`:
```json
{
  "name": "rag-testing-cli",
  // ... rest of package.json
}
```

### 5. Publish to npm

```bash
# Dry run to see what would be published
npm publish --dry-run

# Actually publish (make sure everything looks correct!)
npm publish
```

### 6. Verify Publication

After publishing, check:
```bash
# Search for your package
npm search rag-cli-tester

# View package info
npm info rag-cli-tester
```

### 7. Test Installation

Test the global installation:
```bash
# Unlink local version first
npm unlink -g rag-cli-tester

# Install from npm
npm install -g rag-cli-tester

# Test it works
rag-test --help
```

## Post-Publishing Steps

### Update Documentation
- Add installation instructions to README
- Create usage examples
- Document any limitations

### Version Management
For future updates:
```bash
# Update version
npm version patch  # for bug fixes
npm version minor  # for new features
npm version major  # for breaking changes

# Publish new version
npm publish
```

## Troubleshooting

### "Package already exists"
- Change the package name in `package.json`
- Or use a scoped package: `@yourusername/rag-cli-tester`

### "403 Forbidden"
- Make sure you're logged in: `npm whoami`
- Check package name conflicts
- Verify email is confirmed

### "Cannot publish over existing version"
- Update version in `package.json`
- Or use `npm version patch`

## Alternative: Scoped Package

If the name is taken, you can publish as a scoped package:

1. Update `package.json`:
```json
{
  "name": "@yourusername/rag-cli-tester",
  // ... rest
}
```

2. Publish as public scoped package:
```bash
npm publish --access public
```

## Security Best Practices

- Never include sensitive data in the package
- Use `.npmignore` to exclude unnecessary files
- Keep dependencies up to date
- Use `npm audit` to check for vulnerabilities

## Files Included in Package

The `files` field in `package.json` specifies what gets published:
```json
{
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

This ensures only the built JavaScript, documentation, and license are included.
