import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseConfig, TableInfo } from './types';
import chalk from 'chalk';

export class DatabaseConnection {
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.supabase = createClient(config.url, config.anonKey);
  }

  async testConnection(): Promise<boolean> {
    try {
              const { data, error } = await this.supabase
          .rpc('test_connection');
        
        // Connection is successful if we get data (array of tables) and no error
      this.isConnected = !error && data && Array.isArray(data) && data.length > 0;
      return this.isConnected;
    } catch (error) {
      console.error('Database connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  async getTables(): Promise<string[]> {
    try {
              const { data, error } = await this.supabase
          .rpc('test_connection');
        
        if (error) {
        console.error('Failed to fetch tables:', error);
        return [];
      }
      
      return data?.map((row: any) => row.table_name) || [];
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      return [];
    }
  }

  async getTableInfo(tableName: string): Promise<{
    columns: Array<{ column_name: string; data_type: string; is_nullable: string }>;
    rowCount: number;
    primaryKey?: string;
  } | null> {
    try {
      // Get column information
      const { data: columnsData, error: columnsError } = await this.supabase
        .rpc('get_table_columns', { table_name_param: tableName });

      if (columnsError) {
        console.error('Error getting table columns:', columnsError);
        return null;
      }

      // Get row count
      const { count, error: countError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error getting row count:', countError);
        return null;
      }

      // Try to get primary key information
      let primaryKey: string | undefined;
      try {
        const { data: pkData, error: pkError } = await this.supabase
          .rpc('get_primary_key', { table_name_param: tableName });
        
        if (!pkError && pkData) {
          primaryKey = pkData;
        }
      } catch (e) {
        // Primary key function might not exist, that's okay
        console.log(chalk.gray(`   Note: Could not determine primary key for table ${tableName}`));
      }

      return {
        columns: columnsData || [],
        rowCount: count || 0,
        primaryKey
      };
    } catch (error) {
      console.error('Failed to get table info:', error);
      return null;
    }
  }

  async getTableData(
    tableName: string, 
    columns: string[] = ['*'],
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from(tableName)
        .select(columns.join(','));

      if (limit) query = query.limit(limit);
      if (offset) query = query.range(offset, offset + (limit || 1000) - 1);

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Failed to fetch data from ${tableName}:`, error);
      return [];
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  async getColumnDataType(tableName: string, columnName: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_column_data_type', { 
          table_name_param: tableName, 
          column_name_param: columnName 
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Failed to get column data type for ${tableName}.${columnName}:`, error);
      return null;
    }
  }

  async updateRowEmbedding(
    tableName: string, 
    rowId: any, 
    embeddingColumn: string, 
    embedding: number[],
    idColumn: string = 'id'
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .update({ [embeddingColumn]: embedding })
        .eq(idColumn, rowId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Failed to update embedding for row ${rowId}:`, error);
      return false;
    }
  }

  async updateRowColumn(
    tableName: string, 
    rowId: any, 
    columnName: string, 
    value: any
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .update({ [columnName]: value })
        .eq('id', rowId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Failed to update column ${columnName} for row ${rowId}:`, error);
      return false;
    }
  }

  async getRowsWithoutEmbeddings(
    tableName: string, 
    embeddingColumn: string, 
    sourceColumns: string[],
    limit: number = 100
  ): Promise<any[]> {
    try {
      // Get table info to determine the primary key column
      const tableInfo = await this.getTableInfo(tableName);
      if (!tableInfo) {
        throw new Error(`Could not get table info for ${tableName}`);
      }

      // Also get the actual table structure to debug
      await this.getTableStructure(tableName);

      // Use primary key if available, otherwise fall back to 'id'
      const idColumn = tableInfo.primaryKey || 'id';
      console.log(`🔍 Fetching all rows from table... (using ID column: ${idColumn})`);
      
      // Ensure id column is always included and properly selected
      const selectColumns = [idColumn, ...sourceColumns];
      console.log(`📋 Selecting columns: ${selectColumns.join(', ')}`);
      console.log(`🔍 Query: SELECT ${selectColumns.join(', ')} FROM ${tableName} WHERE ${embeddingColumn} IS NULL LIMIT ${limit}`);
      
      const { data, error } = await this.supabase
        .from(tableName)
        .select(selectColumns.join(','))
        .is(embeddingColumn, null)
        .limit(limit);

      if (error) {
        console.error(`Database error:`, error);
        throw error;
      }
      
      console.log(`📊 Raw database response:`, {
        hasData: !!data,
        dataType: typeof data,
        dataLength: data ? data.length : 'no data',
        firstRow: data && data.length > 0 ? data[0] : 'no rows'
      });
      
      if (!data || data.length === 0) {
        console.log(`📊 Found 0 rows to process`);
        return [];
      }

      // Validate that each row has an id
      const validRows = data.filter((row: any) => {
        if (!row || typeof row !== 'object') {
          console.warn(`Skipping invalid row:`, row);
          return false;
        }
        if (!row[idColumn]) {
          console.warn(`Skipping row without ${idColumn}:`, row);
          return false;
        }
        return true;
      });

      console.log(`📊 Found ${validRows.length} rows to process`);
      
      // Debug: show sample of first row
      if (validRows.length > 0) {
        const sampleRow = validRows[0];
        console.log(`🔍 Sample row structure:`, {
          [idColumn]: (sampleRow as any)[idColumn],
          sourceColumns: sourceColumns.map(col => ({ [col]: (sampleRow as any)[col] }))
        });
      }

      return validRows;
    } catch (error) {
      console.error(`Failed to get rows without embeddings:`, error);
      return [];
    }
  }

  async getRowsWithEmptyColumn(
    tableName: string, 
    targetColumn: string, 
    sourceColumns: string[],
    limit: number = 100
  ): Promise<any[]> {
    try {
      const selectColumns = ['id', ...sourceColumns, targetColumn];
      
      // Get rows where target column is null
      const { data: nullData, error: nullError } = await this.supabase
        .from(tableName)
        .select(selectColumns.join(','))
        .is(targetColumn, null)
        .limit(limit);

      if (nullError) {
        console.error(`Error getting null rows:`, nullError);
        return [];
      }

      // Get rows where target column is empty string
      const { data: emptyData, error: emptyError } = await this.supabase
        .from(tableName)
        .select(selectColumns.join(','))
        .eq(targetColumn, '')
        .limit(limit);

      if (emptyError) {
        console.error(`Error getting empty rows:`, emptyError);
        return nullData || [];
      }

      // Combine and deduplicate results
      const allRows = [...(nullData || []), ...(emptyData || [])];
      const uniqueRows = allRows.filter((row, index, self) => 
        index === self.findIndex(r => (r as any).id === (row as any).id)
      );

      return uniqueRows.slice(0, limit);
    } catch (error) {
      console.error(`Failed to get rows with empty column:`, error);
      return [];
    }
  }

  async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const tableInfo = await this.getTableInfo(tableName);
      if (!tableInfo) return false;
      
      return tableInfo.columns.some(col => col.column_name === columnName);
    } catch (error) {
      console.error(`Failed to check if column exists:`, error);
      return false;
    }
  }

  async getColumnDataCount(tableName: string, columnName: string): Promise<number> {
    try {
      // First try to get count of non-null values
      const { count: nonNullCount, error: nonNullError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .not(columnName, 'is', null);

      if (nonNullError) {
        console.error(`Error counting non-null values:`, nonNullError);
        return 0;
      }

      // Then try to get count of non-empty string values
      const { count: nonEmptyCount, error: nonEmptyError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .not(columnName, 'eq', '');

      if (nonEmptyError) {
        console.error(`Error counting non-empty values:`, nonEmptyError);
        return nonNullCount || 0;
      }

      // Return the higher count (non-null count should be >= non-empty count)
      return Math.max(nonNullCount || 0, nonEmptyCount || 0);
    } catch (error) {
      console.error(`Failed to get column data count:`, error);
      return 0;
    }
  }

  async getEmptyColumnCount(tableName: string, columnName: string): Promise<number> {
    try {
      // Count rows where column is null OR empty string
      // We need to use separate queries since Supabase doesn't support complex OR with count
      const { count: nullCount, error: nullError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .is(columnName, null);

      if (nullError) {
        console.error(`Error counting null values:`, nullError);
        return 0;
      }

      const { count: emptyCount, error: emptyError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq(columnName, '');

      if (emptyError) {
        console.error(`Error counting empty values:`, emptyError);
        return nullCount || 0;
      }

      return (nullCount || 0) + (emptyCount || 0);
    } catch (error) {
      console.error(`Failed to get empty column count:`, error);
      return 0;
    }
  }

  async getTableStructure(tableName: string): Promise<any> {
    try {
      console.log(`🔍 Getting table structure for ${tableName}...`);
      
      // Try to get a sample row to see the structure
      const { data: sampleData, error: sampleError } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (sampleError) {
        console.error(`Error getting sample data:`, sampleError);
        return null;
      }

      if (sampleData && sampleData.length > 0) {
        const sampleRow = sampleData[0];
        console.log(`📋 Table structure from sample row:`, {
          columns: Object.keys(sampleRow),
          idColumn: sampleRow.id ? 'id' : 'no id column found',
          sampleData: sampleRow
        });
        return sampleRow;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get table structure:`, error);
      return null;
    }
  }
}
