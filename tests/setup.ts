// Global test setup
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test timeouts
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Mock console methods during tests unless explicitly testing them
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test utilities
global.testUtils = {
  mockData: {
    validTableData: [
      { id: 1, title: 'Test Document 1', content: 'This is test content 1', category: 'test' },
      { id: 2, title: 'Test Document 2', content: 'This is test content 2', category: 'example' },
      { id: 3, title: 'Test Document 3', content: 'This is test content 3', category: 'demo' },
    ],
    mockTableInfo: {
      name: 'test_table',
      columns: [
        { column_name: 'id', data_type: 'integer', is_nullable: false },
        { column_name: 'title', data_type: 'text', is_nullable: false },
        { column_name: 'content', data_type: 'text', is_nullable: false },
        { column_name: 'category', data_type: 'text', is_nullable: true },
      ],
      rowCount: 3
    }
  }
};

declare global {
  var testUtils: {
    mockData: {
      validTableData: any[];
      mockTableInfo: any;
    };
  };
}
