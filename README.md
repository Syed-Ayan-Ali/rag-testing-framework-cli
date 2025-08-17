# RAG CLI Tester

A lightweight CLI tool for testing RAG (Retrieval-Augmented Generation) systems with different embedding combinations.

## 🚀 Features

- **Column Combination Testing**: Automatically tests different combinations of database columns for optimal embedding generation
- **Multiple Metrics**: Supports both general similarity metrics and specialized BRDR (Banking Regulation Document Retrieval) metrics
- **Local Embeddings**: Uses Hugging Face Transformers models locally (no API keys required)
- **Interactive CLI**: User-friendly command-line interface with guided setup
- **Configurable**: Easy configuration management with file and environment variable support
- **Database Integration**: Works with any Supabase-compatible PostgreSQL database

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

## 📖 Usage

### Configuration

The tool can be configured in multiple ways (in order of priority):

1. **Automatic from .env file** (Recommended):
   ```bash
   # In your project's .env file:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # optional
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

## 🧠 Supported Embedding Models

- `Xenova/all-MiniLM-L6-v2` (Default, lightweight)
- `Xenova/all-mpnet-base-v2` (Better quality, larger)
- `Xenova/multi-qa-MiniLM-L6-cos-v1` (Q&A optimized)

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
    "localModel": "Xenova/all-MiniLM-L6-v2"
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
