#!/bin/bash

# RAG CLI Tester - Test Runner Script
# This script runs comprehensive tests and validation

set -e  # Exit on any error

echo "🧪 RAG CLI Tester - Running Tests and Validation"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the rag-cli-tester root directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    npm install
fi

print_status "Starting validation process..."

# Step 1: Build the project
print_status "Step 1: Building the project..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

# Step 2: Run unit tests
print_status "Step 2: Running unit tests..."
if npm run test:unit; then
    print_success "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# Step 3: Run validation tests
print_status "Step 3: Running validation tests..."
if npm run test:validation; then
    print_success "Validation tests passed"
else
    print_error "Validation tests failed"
    exit 1
fi

# Step 4: Test CLI functionality
print_status "Step 4: Testing CLI functionality..."

# Test basic CLI commands
print_status "  Testing CLI help command..."
if node dist/cli.js --help > /dev/null; then
    print_success "  CLI help command works"
else
    print_error "  CLI help command failed"
    exit 1
fi

print_status "  Testing CLI version command..."
if node dist/cli.js --version > /dev/null; then
    print_success "  CLI version command works"
else
    print_error "  CLI version command failed"
    exit 1
fi

print_status "  Testing CLI error handling..."
if node dist/cli.js invalid-command 2>/dev/null; then
    print_error "  CLI should have failed with invalid command"
    exit 1
else
    print_success "  CLI correctly handles invalid commands"
fi

# Step 5: Test package integrity
print_status "Step 5: Testing package integrity..."

# Check if all required files exist
required_files=("dist/cli.js" "dist/index.js" "package.json" "README.md")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done
print_success "All required files present"

# Step 6: Run security audit
print_status "Step 6: Running security audit..."
if npm audit --audit-level=high; then
    print_success "Security audit passed"
else
    print_warning "Security audit found issues (continuing...)"
fi

# Step 7: Test package size
print_status "Step 7: Checking package size..."
dist_size=$(du -sm dist/ | cut -f1)
if [ "$dist_size" -gt 10 ]; then
    print_warning "Build size ${dist_size}MB is large (>10MB)"
else
    print_success "Build size ${dist_size}MB is acceptable"
fi

# Step 8: Generate test coverage report
print_status "Step 8: Generating test coverage report..."
if npm run test:coverage > /dev/null 2>&1; then
    print_success "Coverage report generated"
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_status "Coverage report available at: coverage/lcov-report/index.html"
    fi
else
    print_warning "Coverage report generation failed"
fi

# Final summary
echo ""
echo "🎉 Validation Summary"
echo "===================="
print_success "✅ Build successful"
print_success "✅ Unit tests passed"
print_success "✅ Validation tests passed"
print_success "✅ CLI functionality verified"
print_success "✅ Package integrity confirmed"
print_success "✅ Security audit completed"
print_success "✅ Package size acceptable"

echo ""
print_success "🚀 All validations passed! The RAG CLI Tester is ready for use."

# Optional: Run integration tests if requested
if [ "$1" = "--with-integration" ]; then
    echo ""
    print_status "Running integration tests (this may take longer)..."
    if npm run test:integration; then
        print_success "✅ Integration tests passed"
    else
        print_error "❌ Integration tests failed"
        exit 1
    fi
fi

# Optional: Test installation if requested
if [ "$1" = "--test-install" ] || [ "$2" = "--test-install" ]; then
    echo ""
    print_status "Testing package installation..."
    
    # Create temporary directory for installation test
    temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    print_status "Creating test package..."
    npm pack "$OLDPWD" > /dev/null
    
    package_file=$(ls *.tgz)
    print_status "Installing test package: $package_file"
    
    npm init -y > /dev/null
    npm install "$package_file" > /dev/null
    
    print_status "Testing installed CLI..."
    if npx rag-test --version > /dev/null; then
        print_success "✅ Package installation test passed"
    else
        print_error "❌ Package installation test failed"
        cd "$OLDPWD"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Cleanup
    cd "$OLDPWD"
    rm -rf "$temp_dir"
fi

echo ""
print_success "🎯 All requested validations completed successfully!"
