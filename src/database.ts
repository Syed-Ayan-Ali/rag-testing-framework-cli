import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseConfig, TableInfo } from './types';

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

  async getTableInfo(tableName: string): Promise<TableInfo | null> {
    try {
      // Get column information using RPC function
      const { data: columnsData, error: columnsError } = await this.supabase
        .rpc('get_table_columns', { table_name_param: tableName });

      if (columnsError) throw columnsError;

      if (!columnsData || columnsData.length === 0) {
        return null;
      }

      // Get row count using RPC function
      const { data: rowCount, error: countError } = await this.supabase
        .rpc('get_table_row_count', { table_name_param: tableName });

      if (countError) {
        console.warn(`Could not get row count for ${tableName}:`, countError);
      }

      return {
        name: tableName,
        columns: columnsData.map((row: any) => ({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable === 'YES'
        })),
        rowCount: rowCount || 0
      };
    } catch (error) {
      console.error(`Failed to get table info for ${tableName}:`, error);
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
    embedding: number[]
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .update({ [embeddingColumn]: embedding })
        .eq('id', rowId);

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
      const selectColumns = ['id', ...sourceColumns];
      const { data, error } = await this.supabase
        .from(tableName)
        .select(selectColumns.join(','))
        .is(embeddingColumn, null)
        .limit(limit);

      if (error) throw error;
      return data || [];
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
      const { data, error } = await this.supabase
        .from(tableName)
        .select(selectColumns.join(','))
        .or(`${targetColumn}.is.null,${targetColumn}.eq.""`)
        .limit(limit);

      if (error) throw error;
      return data || [];
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
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .not(columnName, 'is', null)
        .neq(columnName, '');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Failed to get column data count:`, error);
      return 0;
    }
  }

  async getEmptyColumnCount(tableName: string, columnName: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .or(`${columnName}.is.null,${columnName}.eq.""`);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Failed to get empty column count:`, error);
      return 0;
    }
  }
}
