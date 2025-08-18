import { DatabaseConnection } from '../../src/database';
import { DatabaseConfig } from '../../src/types';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('DatabaseConnection', () => {
  let databaseConnection: DatabaseConnection;
  let mockSupabase: any;
  
  const testConfig: DatabaseConfig = {
    url: 'https://test.supabase.co',
    anonKey: 'test-anon-key'
  };

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis()
    };

    mockCreateClient.mockReturnValue(mockSupabase);
    databaseConnection = new DatabaseConnection(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Supabase client with correct config', () => {
      expect(mockCreateClient).toHaveBeenCalledWith(testConfig.url, testConfig.anonKey);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await databaseConnection.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: new Error('Connection failed') })
        })
      });

      const result = await databaseConnection.testConnection();
      expect(result).toBe(false);
    });

    it('should handle connection exceptions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Network error'))
        })
      });

      const result = await databaseConnection.testConnection();
      expect(result).toBe(false);
    });

    it('should query information_schema.tables for connection test', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await databaseConnection.testConnection();
      
      expect(mockSupabase.from).toHaveBeenCalledWith('information_schema.tables');
    });
  });

  describe('getTables', () => {
    it('should return list of table names', async () => {
      const mockData = [
        { table_name: 'users' },
        { table_name: 'documents' },
        { table_name: 'categories' }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockData, error: null })
          })
        })
      });

      const tables = await databaseConnection.getTables();
      
      expect(tables).toEqual(['users', 'documents', 'categories']);
      expect(mockSupabase.from).toHaveBeenCalledWith('information_schema.tables');
    });

    it('should filter by public schema and base tables', async () => {
      // Create a proper chain mock where eq returns another chainable object
      const finalChain = {
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      
      const firstChain = {
        eq: jest.fn().mockReturnValue(finalChain)
      };
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(firstChain)
      });

      await databaseConnection.getTables();
      
      // Verify the eq methods were called with the correct parameters
      expect(firstChain.eq).toHaveBeenCalledWith('table_schema', 'public');
      expect(finalChain.eq).toHaveBeenCalledWith('table_type', 'BASE TABLE');
    });

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Query failed') })
          })
        })
      });

      const tables = await databaseConnection.getTables();
      expect(tables).toEqual([]);
    });

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      });

      const tables = await databaseConnection.getTables();
      expect(tables).toEqual([]);
    });

    it('should handle null data response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const tables = await databaseConnection.getTables();
      expect(tables).toEqual([]);
    });
  });

  describe('getTableInfo', () => {
    const mockColumnsData = [
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'title', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'content', data_type: 'text', is_nullable: 'NO' }
    ];

    it('should return table information successfully', async () => {
      // Mock columns query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockColumnsData, error: null })
          })
        })
      });

      // Mock count query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 100, error: null })
      });

      const tableInfo = await databaseConnection.getTableInfo('test_table');

      expect(tableInfo).toEqual({
        name: 'test_table',
        columns: [
          { column_name: 'id', data_type: 'integer', is_nullable: false },
          { column_name: 'title', data_type: 'text', is_nullable: true },
          { column_name: 'content', data_type: 'text', is_nullable: false }
        ],
        rowCount: 100
      });
    });

    it('should return null for non-existent table', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const tableInfo = await databaseConnection.getTableInfo('non_existent');
      expect(tableInfo).toBeNull();
    });

    it('should handle columns query error', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Column query failed') })
          })
        })
      });

      const tableInfo = await databaseConnection.getTableInfo('test_table');
      expect(tableInfo).toBeNull();
    });

    it('should handle count query error gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockColumnsData, error: null })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: null, error: new Error('Count failed') })
      });

      const tableInfo = await databaseConnection.getTableInfo('test_table');

      expect(tableInfo).toEqual({
        name: 'test_table',
        columns: [
          { column_name: 'id', data_type: 'integer', is_nullable: false },
          { column_name: 'title', data_type: 'text', is_nullable: true },
          { column_name: 'content', data_type: 'text', is_nullable: false }
        ],
        rowCount: 0
      });
    });

    it('should query information_schema.columns correctly', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockColumnsData, error: null })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 100, error: null })
      });

      await databaseConnection.getTableInfo('test_table');

      const firstCall = mockSupabase.from.mock.calls[0];
      expect(firstCall[0]).toBe('information_schema.columns');
    });
  });

  describe('getTableData', () => {
    const mockTableData = [
      { id: 1, title: 'Doc 1', content: 'Content 1' },
      { id: 2, title: 'Doc 2', content: 'Content 2' },
      { id: 3, title: 'Doc 3', content: 'Content 3' }
    ];

    it('should fetch table data with default parameters', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockTableData, error: null })
      });

      const data = await databaseConnection.getTableData('test_table');

      expect(data).toEqual(mockTableData);
      expect(mockSupabase.from).toHaveBeenCalledWith('test_table');
      expect(mockSupabase.from().select).toHaveBeenCalledWith('*');
    });

    it('should fetch specific columns', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockTableData, error: null })
      });

      await databaseConnection.getTableData('test_table', ['id', 'title']);

      expect(mockSupabase.from().select).toHaveBeenCalledWith('id,title');
    });

    it('should apply limit when specified', async () => {
      const limitSpy = jest.fn().mockResolvedValue({ data: mockTableData.slice(0, 2), error: null });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: limitSpy
        })
      });

      await databaseConnection.getTableData('test_table', ['*'], 2);

      expect(limitSpy).toHaveBeenCalledWith(2);
    });

    it('should apply offset with range when specified', async () => {
      const rangeSpy = jest.fn().mockResolvedValue({ data: mockTableData.slice(1, 3), error: null });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            range: rangeSpy
          })
        })
      });

      await databaseConnection.getTableData('test_table', ['*'], 2, 1);

      expect(rangeSpy).toHaveBeenCalledWith(1, 2); // offset + limit - 1
    });

    it('should handle query errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: new Error('Query failed') })
      });

      const data = await databaseConnection.getTableData('test_table');
      expect(data).toEqual([]);
    });

    it('should handle exceptions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Network error'))
      });

      const data = await databaseConnection.getTableData('test_table');
      expect(data).toEqual([]);
    });

    it('should handle null data response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const data = await databaseConnection.getTableData('test_table');
      expect(data).toEqual([]);
    });

    it('should use default limit of 1000 when offset is provided without limit', async () => {
      const rangeSpy = jest.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          range: rangeSpy
        })
      });

      await databaseConnection.getTableData('test_table', ['*'], undefined, 10);

      expect(rangeSpy).toHaveBeenCalledWith(10, 1009); // offset + 1000 - 1
    });
  });

  describe('isConnectionActive', () => {
    it('should return false initially', () => {
      expect(databaseConnection.isConnectionActive()).toBe(false);
    });

    it('should return true after successful connection test', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await databaseConnection.testConnection();
      expect(databaseConnection.isConnectionActive()).toBe(true);
    });

    it('should return false after failed connection test', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: new Error('Failed') })
        })
      });

      await databaseConnection.testConnection();
      expect(databaseConnection.isConnectionActive()).toBe(false);
    });
  });
});
