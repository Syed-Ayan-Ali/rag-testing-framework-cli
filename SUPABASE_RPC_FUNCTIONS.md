# Required Supabase RPC Functions

Due to Supabase's security restrictions, you cannot directly query `information_schema` tables via REST API. Instead, you need to create these RPC functions in your Supabase database.

## 1. test_connection

**Purpose**: Test database connection and get list of tables
**Function Name**: `test_connection`
**Return Type**: `json`

```sql
CREATE OR REPLACE FUNCTION test_connection()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object('table_name', table_name)
    )
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  );
END;
$$;
```

## 2. get_table_columns

**Purpose**: Get column information for a specific table
**Function Name**: `get_table_columns`
**Parameters**: `table_name_param text`
**Return Type**: `json`

```sql
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'column_name', column_name,
        'data_type', data_type,
        'is_nullable', is_nullable
      )
    )
    FROM information_schema.columns
    WHERE table_name = table_name_param
    AND table_schema = 'public'
  );
END;
$$;
```

## 3. get_table_row_count

**Purpose**: Get row count for a specific table
**Function Name**: `get_table_row_count`
**Parameters**: `table_name_param text`
**Return Type**: `bigint`

```sql
CREATE OR REPLACE FUNCTION get_table_row_count(table_name_param text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_count bigint;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I', table_name_param) INTO row_count;
  RETURN row_count;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 0;
END;
$$;
```

## How to Create These Functions

1. **Go to your Supabase Dashboard**
2. **Navigate to**: SQL Editor
3. **Create each function** by running the SQL above
4. **Test the functions** in SQL Editor:
   ```sql
   SELECT test_connection();
   SELECT get_table_columns('your_table_name');
   SELECT get_table_row_count('your_table_name');
   ```

## Expected Returns

### test_connection()
```json
[
  {"table_name": "chats"},
  {"table_name": "searches"},
  {"table_name": "brdr_documents_data"},
  {"table_name": "image_content"},
  {"table_name": "collections"},
  {"table_name": "topics"},
  {"table_name": "concepts"},
  {"table_name": "brdr_documents"}
]
```

### get_table_columns('brdr_documents')
```json
[
  {"column_name": "id", "data_type": "integer", "is_nullable": "NO"},
  {"column_name": "title", "data_type": "text", "is_nullable": "YES"},
  {"column_name": "content", "data_type": "text", "is_nullable": "NO"}
]
```

### get_table_row_count('brdr_documents')
```
1250
```

These functions will enable the RAG CLI Tester to work properly with your Supabase database!
