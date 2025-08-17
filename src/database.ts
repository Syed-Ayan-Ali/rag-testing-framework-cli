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
      const { error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);
      
      this.isConnected = !error;
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
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
      
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
      // Get column information
      const { data: columnsData, error: columnsError } = await this.supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', tableName)
        .eq('table_schema', 'public');

      if (columnsError) throw columnsError;

      if (!columnsData || columnsData.length === 0) {
        return null;
      }

      // Get row count
      const { count, error: countError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

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
        rowCount: count || 0
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
