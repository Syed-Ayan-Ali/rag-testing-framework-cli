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
        console.log('data is: ', data);
        console.log('error is: ', error);
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

      console.log('data is: ', data);
      console.log('error is: ', error);
      
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
}
