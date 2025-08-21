# RAG CLI Tester

A lightweight CLI tool for testing RAG (Retrieval-Augmented Generation) systems with different embedding combinations.

## 🚀 Features

- **Column Combination Testing**: Automatically tests different combinations of database columns for optimal embedding generation
- **Multiple Metrics**: Supports both general similarity metrics and specialized BRDR (Banking Regulation Document Retrieval) metrics
- **Multi-Provider Embeddings**: Supports local models (Hugging Face), OpenAI, and Gemini embedding providers
- **LLM-Powered Content Generation**: Automatically populate database columns using OpenAI, Gemini, or Anthropic LLMs
- **Interactive CLI**: User-friendly command-line interface with guided setup
- **Configurable**: Easy configuration management with file and environment variable support
- **Database Integration**: Works with any Supabase-compatible PostgreSQL database
- **Dynamic Schema Detection**: Automatically detects column types and optimizes data formatting

## 📦 Installation

```bash
npm install -g rag-cli-tester
```

## 🔧 Quick Start

### 1. Automatic Configuration (Recommended)

If you're in a Next.js project with Supabase, the tool will automatically use your existing `.env` file:

```bash
# Your .env file should contain:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

No additional configuration needed! The tool will automatically detect and use these variables.

### 1b. Manual Configuration (Alternative)

If you don't have a `.env` file or want to override settings:

```bash
rag-test configure
```

This will guide you through setting up:
- Database connection (Supabase URL and API key)
- Embedding model selection
- Output directory

### 2. List available tables

```bash
rag-test tables
```

### 3. Inspect a table structure

```bash
rag-test inspect <table-name>
```

### 4. Run a test experiment

Interactive mode:
```bash
rag-test test
```

Command-line mode:
```bash
rag-test test --table my_table --columns "title,content,summary" --query question --answer answer --metric similarity
```

### 5. Generate embeddings for your data

```bash
rag-test generate-embeddings --table documents --columns "title,content" --embedding-column embedding_vector
```

### 6. Populate columns with AI-generated content

```bash
rag-test populate-column --table documents --source-column content --target-column tags --prompt-type tags
```

## 📖 Usage

### Configuration

The tool can be configured in multiple ways (in order of priority):

1. **Automatic from .env file** (Recommended):
   ```bash
   # In your project's .env file:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   
   # Optional: Embedding providers
   EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # local model
   OPENAI_API_KEY=your-openai-key
   GEMINI_API_KEY=your-gemini-key
   
   # Optional: LLM providers
   OPENAI_API_KEY=your-openai-key
   GEMINI_API_KEY=your-gemini-key
   ANTHROPIC_API_KEY=your-anthropic-key
   
   # Custom OpenAI-compatible API
   CUSTOM_API_KEY=your-custom-key
   CUSTOM_ENDPOINT=https://your-api.com/v1/chat/completions
   CUSTOM_MODEL=your-model-name
   
   # Example for Qwen 3:
# CUSTOM_API_KEY=ms-12345678-...
# CUSTOM_ENDPOINT=https://api-inference.modelscope.cn/v1/chat/completions
# CUSTOM_MODEL=Qwen/Qwen3-Coder-30B-A3B-Instruct
#
# Note: The endpoint must end with /chat/completions for OpenAI-compatible APIs
# Qwen models require enable_thinking=false and stream=false (automatically set)
   ```

2. **Interactive setup**: `rag-test configure`

3. **Alternative environment variables**:
   ```bash
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_ANON_KEY="your-anon-key"
   export EMBEDDING_MODEL="Xenova/all-MiniLM-L6-v2"
   ```

4. **Config file**: `.rag-config.json` in your working directory

### Commands

#### `configure`
Set up database connection and embedding model configuration.

#### `tables`
List all available tables in your database.

#### `inspect <tableName>`
Show table structure, column types, and sample data.

#### `test [options]`
Run RAG testing experiment.

**Options:**
- `-t, --table <tableName>`: Table name to test
- `-c, --columns <columns>`: Comma-separated list of columns for embeddings
- `-q, --query <column>`: Column containing queries
- `-a, --answer <column>`: Column containing expected answers
- `-m, --metric <type>`: Metric type (`similarity` or `brdr`)
- `-r, --ratio <number>`: Training ratio (0-1, default: 0.8)
- `-n, --name <name>`: Test name
- `-l, --limit <number>`: Max combinations to test (default: 20)

#### `generate-embeddings [options]`
Generate embeddings for table rows using different embedding providers.

**Options:**
- `-t, --table <table>`: Table name
- `-c, --columns <columns>`: Comma-separated list of columns to combine
- `--custom-order`: Use exact column order (default: alphabetical)
- `-e, --embedding-column <column>`: Column to store embeddings
- `-b, --batch-size <size>`: Batch size for processing (default: 50)
- `-p, --provider <provider>`: Embedding provider (local, openai, gemini)

**Example:**
```bash
rag-test generate-embeddings -t documents -c "title,content" -e embedding_vector -p openai
```

#### `populate-column [options]`
Use LLM to populate empty columns based on other columns.

**Options:**
- `-t, --table <table>`: Table name
- `-s, --source-column <column>`: Source column to base content on
- `-c, --target-column <column>`: Target column to populate
- `-p, --provider <provider>`: LLM provider (openai, gemini, anthropic)
- `--prompt-type <type>`: Predefined prompt type (tags, description, summary, keywords)
- `--custom-prompt <prompt>`: Custom prompt for LLM
- `-b, --batch-size <size>`: Batch size for processing (default: 10)

**Example:**
```bash
rag-test populate-column -t documents -s content -c tags --prompt-type tags -p openai
```

### Example Workflow

```bash
# 1. Set up configuration
rag-test configure

# 2. Check available tables
rag-test tables

# 3. Inspect your target table
rag-test inspect documents

# 4. Run interactive test
rag-test test

# 5. Or run with specific parameters
rag-test test \
  --table documents \
  --columns "title,summary,content" \
  --query user_question \
  --answer expected_response \
  --metric brdr \
  --ratio 0.8 \
  --name "Document_Retrieval_Test"
```

## 🎯 Metrics

### Similarity Metric
General-purpose metric that combines:
- Cosine similarity between embeddings
- Exact match detection
- Normalized scoring (0-1)

### BRDR Metric
Specialized metric for banking regulation documents:
- Keyword matching (regulatory terms)
- Concept alignment (banking concepts)
- Contextual relevance (embedding similarity)
- Domain-specific weighting

## 🧠 Supported Providers

### Embedding Providers
- **Local Models** (Default, no API key required):
  - `Xenova/all-MiniLM-L6-v2-small` (Default, ~384 dimensions) ⭐ **Recommended for Supabase**
  - `Xenova/all-MiniLM-L6-v2` (~384 dimensions)
  - `Xenova/all-MiniLM-L6-v2-base` (~384 dimensions)
  - `Xenova/all-mpnet-base-v2` (~768 dimensions)
  - `Xenova/multi-qa-MiniLM-L6-cos-v1` (~384 dimensions, Q&A optimized)
- **OpenAI**: text-embedding-3-small (1536 dimensions), text-embedding-3-large (3072 dimensions)
- **Gemini**: embedding-001 (768 dimensions)

> **Note**: Supabase has a 16000 dimension limit for vector columns. The default local model produces 384-dimensional embeddings, which is well within this limit and provides excellent performance.

### LLM Providers  
- **OpenAI**: GPT-3.5-turbo, GPT-4, GPT-4-turbo
- **Gemini**: gemini-pro, gemini-pro-vision
- **Anthropic**: Claude-3-sonnet, Claude-3-haiku
- **Custom**: Any OpenAI-compatible API endpoint

## 📊 Output

Test results include:
- **Best performing combination** with score
- **Top 5 combinations** ranked by performance
- **Detailed metrics** for each combination
- **Processing time** and statistics
- **JSON export** for further analysis

Results are saved to the configured output directory (default: `./rag-test-results/`).

## 🏗️ Database Requirements

Your database should have:
- A table with text columns for embedding generation
- A column with queries/questions
- A column with expected answers/responses
- Sufficient data for train/test split (recommended: 50+ rows)

## 🔧 Configuration File Example

`.rag-config.json`:
```json
{
  "database": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key"
  },
  "embedding": {
    "model": "local",
    "localModel": "Xenova/all-MiniLM-L6-v2-small"
  },
  "outputPath": "./rag-test-results"
}
```

## 🐛 Troubleshooting

### "No tables found"
- Check your database connection
- Ensure you have public tables
- Verify your Supabase credentials

### "Failed to initialize embedding model"
- Check your internet connection (for model download)
- Ensure sufficient disk space
- Try a different embedding model

### "Not enough valid data"
- Check that your query and answer columns have data
- Ensure selected columns have values
- Consider increasing your dataset size

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [Hugging Face Transformers](https://huggingface.co/docs/transformers)
- [Supabase](https://supabase.com/)
- [Node.js CLI Tools](https://nodejs.org/)
