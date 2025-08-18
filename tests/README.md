# RAG CLI Tester - Testing Framework

This directory contains comprehensive testing scripts for the RAG CLI Tester framework. The tests are designed to validate the framework itself, not the functionality of the framework when testing RAG systems.

## Test Structure

```
tests/
├── fixtures/           # Test data and mock configurations
├── unit/              # Unit tests for individual components
├── validation/        # Integration and validation tests
├── setup.ts          # Global test setup and utilities
└── README.md         # This documentation
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Unit tests focus on testing individual components in isolation:

- **`embeddings.test.ts`** - Tests the EmbeddingGenerator class
  - Embedding model initialization
  - Column combination generation
  - Text embedding generation
  - Cosine similarity calculations
  - Training data processing
  - Query processing

- **`metrics.test.ts`** - Tests the metric calculation classes
  - SimilarityMetric calculations
  - BRDRMetric calculations
  - Keyword and concept extraction
  - Score normalization

- **`database.test.ts`** - Tests the DatabaseConnection class
  - Database connection testing
  - Table listing and inspection
  - Data retrieval with filters
  - Error handling

### 2. Validation Tests (`tests/validation/`)

Validation tests focus on integration and end-to-end functionality:

- **`cli-validation.test.ts`** - Tests CLI interface and commands
  - Command help and version display
  - Argument parsing and validation
  - Error handling for invalid inputs
  - Process management and timeouts
  - Output formatting

- **`integration.test.ts`** - Tests component integration
  - RAGTester workflow validation
  - Configuration validation
  - Error recovery and resilience
  - Performance and resource management
  - End-to-end experiment execution

## Running Tests

### All Tests
```bash
npm test                 # Run all tests
npm run test:all        # Run all tests with coverage
```

### Specific Test Suites
```bash
npm run test:unit       # Run only unit tests
npm run test:validation # Run only validation tests
npm run test:integration # Run only integration tests
npm run test:cli        # Run only CLI validation tests
```

### Development
```bash
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

### Validation Before Release
```bash
npm run validate        # Build + test + validate everything
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Environment**: Node.js
- **Test Pattern**: `**/*.(test|spec).ts`
- **Coverage**: Collects from `src/**/*.ts` (excludes CLI entry point)
- **Timeout**: 30 seconds for individual tests
- **Setup**: Global setup in `tests/setup.ts`

### Global Test Setup (`tests/setup.ts`)

- Environment variable loading
- Console mocking to reduce noise
- Global test utilities and mock data
- Timeout configuration

### Test Fixtures (`tests/fixtures/`)

- **`test-data.json`** - Sample data for testing
  - Mock table data with banking/regulatory content
  - Test queries and expected answers
  - Column combinations for testing

## Testing Strategies

### 1. Component Isolation

Each component is tested in isolation with mocked dependencies:

```typescript
// Example: Testing EmbeddingGenerator without real AI model
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn()
}));
```

### 2. Error Scenario Testing

Tests include comprehensive error scenarios:

- Network failures
- Invalid configurations
- Missing data
- Resource constraints

### 3. Integration Validation

Integration tests validate component interactions:

- Data flow between components
- Configuration propagation
- Error handling across component boundaries

### 4. CLI Interface Testing

CLI tests validate the user interface:

- Command argument parsing
- Help and error messages
- Process lifecycle management
- Cross-platform compatibility

## Continuous Integration

### GitHub Actions Workflow (`.github/workflows/ci-validation.yml`)

The CI workflow includes multiple validation stages:

1. **Lint and Format Check**
   - TypeScript compilation
   - Code formatting validation

2. **Unit Tests**
   - Component isolation testing
   - Coverage reporting

3. **Validation Tests**
   - Integration testing
   - CLI functionality testing

4. **Security Scan**
   - Dependency vulnerability checks
   - Security audit

5. **Performance Tests**
   - Build size validation
   - CLI startup performance
   - Memory usage monitoring

6. **Cross-Platform Testing**
   - Multiple OS testing (Ubuntu, Windows, macOS)
   - Multiple Node.js versions (18, 20)

7. **Package Validation**
   - Package.json validation
   - Installation testing
   - TypeScript definitions check

8. **Documentation Check**
   - README.md completeness
   - CLI help documentation

## Writing New Tests

### Unit Test Template

```typescript
import { ComponentToTest } from '../../src/component';

describe('ComponentToTest', () => {
  let component: ComponentToTest;

  beforeEach(() => {
    component = new ComponentToTest();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Error test implementation
    });
  });
});
```

### Integration Test Template

```typescript
describe('Integration Test Name', () => {
  beforeAll(async () => {
    // Setup integration environment
  });

  afterAll(async () => {
    // Cleanup integration environment
  });

  it('should complete end-to-end workflow', async () => {
    // Integration test implementation
  });
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use proper setup/teardown
- Mock external dependencies

### 2. Descriptive Test Names
- Use clear, descriptive test names
- Follow the pattern: "should [expected behavior] when [condition]"

### 3. Comprehensive Coverage
- Test both success and failure scenarios
- Include edge cases and boundary conditions
- Validate error messages and codes

### 4. Performance Considerations
- Set appropriate timeouts
- Mock heavy operations
- Use test data of reasonable size

### 5. Maintainability
- Keep tests simple and focused
- Use helper functions for common operations
- Document complex test scenarios

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout in jest.config.js
   - Mock async operations
   - Check for infinite loops

2. **Mock Issues**
   - Ensure mocks are properly reset
   - Verify mock implementations
   - Check mock call expectations

3. **Environment Issues**
   - Verify test environment setup
   - Check environment variable loading
   - Ensure proper cleanup

### Debug Commands

```bash
# Run specific test file
npm test -- embeddings.test.ts

# Run tests with verbose output
npm test -- --verbose

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test by name pattern
npm test -- --testNamePattern="should handle error case"
```

## Contributing

When adding new features:

1. Write unit tests for new components
2. Add integration tests for new workflows
3. Update CLI validation tests if adding commands
4. Ensure all tests pass before submitting PR
5. Update this documentation if needed

The testing framework ensures the RAG CLI Tester is reliable, maintainable, and production-ready.
