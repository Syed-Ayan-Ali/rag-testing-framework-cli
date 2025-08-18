# RAG CLI Tester - Testing on Windows

This guide provides Windows-specific instructions for running the comprehensive testing framework.

## Prerequisites

1. **Node.js 18+** installed on your Windows system
2. **PowerShell 5.1+** (comes with Windows 10/11)
3. **Git** (optional, for version control)

## Quick Start (Windows PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Run comprehensive validation
npm run test:runner

# 3. Run with integration tests (longer)
npm run test:runner:integration

# 4. Run with installation testing
npm run test:runner:install
```

## Available Test Commands

### Basic Testing
```powershell
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only validation tests
npm run test:validation

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Comprehensive Validation
```powershell
# Full validation suite (recommended)
npm run test:runner

# Validation with integration tests
npm run test:runner:integration

# Validation with package installation test
npm run test:runner:install

# Manual validation build + test
npm run validate
```

### Individual Test Categories
```powershell
# CLI-specific tests
npm run test:cli

# Integration tests only
npm run test:integration

# Specific test file
npm test -- embeddings.test.ts

# Specific test pattern
npm test -- --testNamePattern="should handle error"
```

## PowerShell Test Runner Features

The PowerShell test runner (`scripts/run-tests.ps1`) provides:

### ✅ **Comprehensive Validation**
- Project build verification
- Unit test execution
- Validation test execution
- CLI functionality testing
- Package integrity checks
- Security audit
- Performance monitoring
- Coverage report generation

### 🎯 **Windows-Optimized**
- Native PowerShell commands
- Windows file path handling
- Proper exit code handling
- Colored console output
- Temporary directory management

### 🚀 **Additional Features**
```powershell
# Run with integration tests (slower but thorough)
npm run test:runner:integration

# Test package installation process
npm run test:runner:install

# Direct PowerShell execution with parameters
powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -WithIntegration -TestInstall
```

## Manual Testing Commands

### Build and Basic Validation
```powershell
# Build the project
npm run build

# Test CLI help
node dist/cli.js --help

# Test CLI version
node dist/cli.js --version

# Test CLI commands
node dist/cli.js configure --help
node dist/cli.js tables --help
node dist/cli.js test --help
```

### Testing CLI Error Handling
```powershell
# Should show error for invalid command
node dist/cli.js invalid-command

# Should show error for missing arguments
node dist/cli.js inspect
```

### Package Validation
```powershell
# Check package size
Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum

# Validate package.json
node -e "console.log(JSON.stringify(require('./package.json'), null, 2))"

# Test package creation
npm pack
```

## Test Environment Setup

### 1. Create Test Environment File
```powershell
# Copy the example file
Copy-Item "env.test.example" ".env.test"

# Edit .env.test with your test database credentials
notepad .env.test
```

### 2. Set Environment Variables (Optional)
```powershell
# Set test environment
$env:NODE_ENV = "test"

# Set test timeout
$env:TEST_TIMEOUT = "30000"
```

## Troubleshooting Windows Issues

### PowerShell Execution Policy
If you get execution policy errors:
```powershell
# Check current policy
Get-ExecutionPolicy

# Set policy for current user (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass (safer)
powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1
```

### Path Issues
```powershell
# Verify Node.js installation
node --version
npm --version

# Check if TypeScript is available
npx tsc --version

# Verify Jest installation
npx jest --version
```

### Permission Issues
```powershell
# Run PowerShell as Administrator if needed
# Or ensure your user has write permissions to the project directory
```

### Common Error Solutions

#### "Cannot find module" errors
```powershell
# Clean install
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

#### Build failures
```powershell
# Clean build
Remove-Item -Recurse -Force dist
npm run build
```

#### Test failures
```powershell
# Run specific failing test
npm test -- --testNamePattern="failing test name"

# Run with verbose output
npm test -- --verbose

# Clear Jest cache
npx jest --clearCache
```

## Performance Monitoring

### Build Size Check
```powershell
# Check dist folder size
$distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Build size: $([math]::Round($distSize, 1))MB"
```

### Test Performance
```powershell
# Time the test execution
Measure-Command { npm run test:unit }

# Memory usage monitoring
Get-Process node | Select-Object Name, WorkingSet, VirtualMemorySize
```

## CI/CD Integration

The GitHub Actions workflow supports Windows testing:

```yaml
# In .github/workflows/ci-validation.yml
cross-platform:
  strategy:
    matrix:
      os: [ubuntu-latest, windows-latest, macos-latest]
  runs-on: ${{ matrix.os }}
```

### Local CI Simulation
```powershell
# Simulate CI environment
$env:CI = "true"
$env:NODE_ENV = "test"
npm run validate
```

## Coverage Reports

### Generate Coverage
```powershell
# Generate HTML coverage report
npm run test:coverage

# View coverage report
# Navigate to: coverage/lcov-report/index.html
Invoke-Item coverage/lcov-report/index.html
```

### Coverage Thresholds
The Jest configuration includes coverage thresholds. Modify in `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

## Integration with VS Code

### Recommended Extensions
- **Jest** - For test execution in VS Code
- **Coverage Gutters** - For inline coverage display
- **PowerShell** - For better PowerShell script editing

### VS Code Tasks
Add to `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "npm",
      "args": ["run", "test:runner"],
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

## Summary

You now have a complete testing framework with Windows-optimized tools:

✅ **Unit Tests** - Individual component testing  
✅ **Validation Tests** - Integration and CLI testing  
✅ **PowerShell Runner** - Comprehensive validation script  
✅ **GitHub Actions** - Automated CI/CD pipeline  
✅ **Coverage Reports** - Code coverage analysis  
✅ **Performance Monitoring** - Build size and performance tracking  

**To get started, simply run:**
```powershell
npm run test:runner
```

This will execute the full validation suite and provide a comprehensive report of your RAG CLI Tester's health and functionality!
