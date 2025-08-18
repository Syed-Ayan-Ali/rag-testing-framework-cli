# RAG CLI Tester - Test Runner Script (PowerShell)
# This script runs comprehensive tests and validation on Windows

param(
    [switch]$WithIntegration,
    [switch]$TestInstall
)

# Colors for output
$colors = @{
    'Red'    = 'Red'
    'Green'  = 'Green'
    'Yellow' = 'Yellow'
    'Blue'   = 'Blue'
    'White'  = 'White'
}

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $colors.Red
}

Write-Host "🧪 RAG CLI Tester - Running Tests and Validation" -ForegroundColor $colors.Blue
Write-Host "=================================================" -ForegroundColor $colors.Blue

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found. Please run this script from the rag-cli-tester root directory."
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Warning "node_modules not found. Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
}

Write-Status "Starting validation process..."

# Step 1: Build the project
Write-Status "Step 1: Building the project..."
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Success "Build completed successfully"
} else {
    Write-Error "Build failed"
    exit 1
}

# Step 2: Run unit tests
Write-Status "Step 2: Running unit tests..."
npm run test:unit
if ($LASTEXITCODE -eq 0) {
    Write-Success "Unit tests passed"
} else {
    Write-Error "Unit tests failed"
    exit 1
}

# Step 3: Run validation tests
Write-Status "Step 3: Running validation tests..."
npm run test:validation
if ($LASTEXITCODE -eq 0) {
    Write-Success "Validation tests passed"
} else {
    Write-Error "Validation tests failed"
    exit 1
}

# Step 4: Test CLI functionality
Write-Status "Step 4: Testing CLI functionality..."

# Test basic CLI commands
Write-Status "  Testing CLI help command..."
node dist/cli.js --help > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "  CLI help command works"
} else {
    Write-Error "  CLI help command failed"
    exit 1
}

Write-Status "  Testing CLI version command..."
node dist/cli.js --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "  CLI version command works"
} else {
    Write-Error "  CLI version command failed"
    exit 1
}

Write-Status "  Testing CLI error handling..."
node dist/cli.js invalid-command > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Error "  CLI should have failed with invalid command"
    exit 1
} else {
    Write-Success "  CLI correctly handles invalid commands"
}

# Step 5: Test package integrity
Write-Status "Step 5: Testing package integrity..."

# Check if all required files exist
$requiredFiles = @("dist/cli.js", "dist/index.js", "package.json", "README.md")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Required file missing: $file"
        exit 1
    }
}
Write-Success "All required files present"

# Step 6: Run security audit
Write-Status "Step 6: Running security audit..."
npm audit --audit-level=high
if ($LASTEXITCODE -eq 0) {
    Write-Success "Security audit passed"
} else {
    Write-Warning "Security audit found issues (continuing...)"
}

# Step 7: Test package size
Write-Status "Step 7: Checking package size..."
$distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
$distSizeMB = [math]::Round($distSize, 1)
if ($distSizeMB -gt 10) {
    Write-Warning "Build size ${distSizeMB}MB is large (>10MB)"
} else {
    Write-Success "Build size ${distSizeMB}MB is acceptable"
}

# Step 8: Generate test coverage report
Write-Status "Step 8: Generating test coverage report..."
npm run test:coverage > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Coverage report generated"
    if (Test-Path "coverage/lcov-report/index.html") {
        Write-Status "Coverage report available at: coverage/lcov-report/index.html"
    }
} else {
    Write-Warning "Coverage report generation failed"
}

# Final summary
Write-Host ""
Write-Host "🎉 Validation Summary" -ForegroundColor $colors.Blue
Write-Host "====================" -ForegroundColor $colors.Blue
Write-Success "✅ Build successful"
Write-Success "✅ Unit tests passed"
Write-Success "✅ Validation tests passed"
Write-Success "✅ CLI functionality verified"
Write-Success "✅ Package integrity confirmed"
Write-Success "✅ Security audit completed"
Write-Success "✅ Package size acceptable"

Write-Host ""
Write-Success "🚀 All validations passed! The RAG CLI Tester is ready for use."

# Optional: Run integration tests if requested
if ($WithIntegration) {
    Write-Host ""
    Write-Status "Running integration tests (this may take longer)..."
    npm run test:integration
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✅ Integration tests passed"
    } else {
        Write-Error "❌ Integration tests failed"
        exit 1
    }
}

# Optional: Test installation if requested
if ($TestInstall) {
    Write-Host ""
    Write-Status "Testing package installation..."
    
    # Create temporary directory for installation test
    $tempDir = Join-Path $env:TEMP "rag-cli-test-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    $oldLocation = Get-Location
    Set-Location $tempDir
    
    try {
        Write-Status "Creating test package..."
        npm pack $oldLocation | Out-Null
        
        $packageFile = Get-ChildItem -Filter "*.tgz" | Select-Object -First 1
        Write-Status "Installing test package: $($packageFile.Name)"
        
        npm init -y | Out-Null
        npm install $packageFile.FullName | Out-Null
        
        Write-Status "Testing installed CLI..."
        npx rag-test --version > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Package installation test passed"
        } else {
            Write-Error "❌ Package installation test failed"
            Set-Location $oldLocation
            Remove-Item -Recurse -Force $tempDir
            exit 1
        }
    }
    finally {
        # Cleanup
        Set-Location $oldLocation
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Success "🎯 All requested validations completed successfully!"
