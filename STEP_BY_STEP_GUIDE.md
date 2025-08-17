# Complete Step-by-Step Guide: RAG CLI Tester

## 🎯 What We've Built

A lightweight CLI tool that:
- Tests different column combinations for RAG embeddings
- Works with Supabase/PostgreSQL databases
- Uses local Hugging Face models (no API keys needed)
- Provides interactive command-line interface
- Exports detailed test results

## 📋 Step-by-Step Instructions

### Step 1: Publish to npm

1. **Create npm account** (if you don't have one):
   - Go to https://www.npmjs.com/signup
   - Create account and verify email

2. **Login to npm**:
   ```bash
   cd rag-cli-tester
   npm login
   ```

3. **Check if package name is available**:
   ```bash
   npm search rag-cli-tester
   ```
   
   If taken, update the name in `package.json`:
   ```json
   {
     "name": "your-unique-rag-tester",
     // ... rest of package.json
   }
   ```

4. **Publish the package**:
   ```bash
   # Final build
   npm run build
   
   # Dry run to check what will be published
   npm publish --dry-run
   
   # Actually publish
   npm publish
   ```

5. **Verify publication**:
   ```bash
   npm info rag-cli-tester
   ```

### Step 2: Install in my-ai-app

1. **Navigate to your my-ai-app directory**:
   ```bash
   cd ../my-ai-app
   ```

2. **Install the CLI tool globally**:
   ```bash
   npm install -g rag-cli-tester
   ```
   
   Or if you changed the name:
   ```bash
   npm install -g your-unique-rag-tester
   ```

3. **Verify installation**:
   ```bash
   rag-test --help
   ```

### Step 3: Configure the CLI Tool

1. **Set up configuration**:
   ```bash
   rag-test configure
   ```

2. **You'll be prompted for**:
   - **Supabase URL**: Your project URL from Supabase dashboard
   - **Supabase Anon Key**: Your public anon key from Supabase
   - **Embedding Model**: Choose from:
     - `Xenova/all-MiniLM-L6-v2` (Default, fast)
     - `Xenova/all-mpnet-base-v2` (Better quality)
     - `Xenova/multi-qa-MiniLM-L6-cos-v1` (Q&A optimized)
   - **Output Directory**: Where to save results (default: `./rag-test-results`)

### Step 4: Explore Your Database

1. **List available tables**:
   ```bash
   rag-test tables
   ```

2. **Inspect a specific table**:
   ```bash
   rag-test inspect your_table_name
   ```
   
   This shows:
   - Column names and types
   - Row count
   - Sample data

### Step 5: Run Your First Test

#### Option A: Interactive Mode (Recommended for first time)

```bash
rag-test test
```

This will guide you through:
- Selecting a table
- Choosing columns for embeddings
- Selecting query and answer columns
- Choosing evaluation metric
- Setting training/test split ratio

#### Option B: Command Line Mode

```bash
rag-test test \
  --table your_documents_table \
  --columns "title,content,summary" \
  --query question_column \
  --answer answer_column \
  --metric similarity \
  --ratio 0.8 \
  --name "My_RAG_Test" \
  --limit 15
```

### Step 6: Analyze Results

After running a test, you'll see:

1. **Real-time progress**:
   - Column combination being tested
   - Processing status
   - Scores for each combination

2. **Final results**:
   - Best performing combination
   - Top 5 combinations with scores
   - Summary statistics
   - Processing time

3. **Saved results**:
   - JSON file in your output directory
   - Detailed metrics for further analysis

## 🎯 Example Test Scenario

Let's say you have a table `brdr_documents` with columns:
- `title`: Document title
- `summary`: Document summary  
- `content`: Full document content
- `keywords`: Document keywords
- `question`: User questions
- `expected_answer`: Expected responses

**Test Command**:
```bash
rag-test test \
  --table brdr_documents \
  --columns "title,summary,content,keywords" \
  --query question \
  --answer expected_answer \
  --metric brdr \
  --name "BRDR_Document_Retrieval_Test"
```

**This will test combinations like**:
- `title` only
- `summary` only
- `title + summary`
- `title + content`
- `summary + content + keywords`
- And more...

## 📊 Understanding Results

### Metrics Explained

**Similarity Metric** (General purpose):
- Combines cosine similarity with exact match detection
- Scale: 0.0 to 1.0 (higher is better)
- Good for general Q&A tasks

**BRDR Metric** (Banking regulation specific):
- Specialized for regulatory documents
- Considers regulatory keywords, concepts, and context
- Scale: 0.0 to 1.0 (higher is better)
- Optimized for banking/finance documents

### Result Interpretation

- **Score > 0.8**: Excellent performance
- **Score 0.6-0.8**: Good performance  
- **Score 0.4-0.6**: Moderate performance
- **Score < 0.4**: Poor performance, consider different columns

## 🔧 Troubleshooting

### Common Issues

1. **"No tables found"**:
   - Check Supabase credentials
   - Ensure tables exist in public schema
   - Verify database connection

2. **"Not enough valid data"**:
   - Ensure query/answer columns have data
   - Check for null values in selected columns
   - Consider using more data

3. **"Failed to initialize embedding model"**:
   - Check internet connection (for model download)
   - Ensure sufficient disk space (~200MB)
   - Try a different embedding model

4. **Low scores across all combinations**:
   - Check data quality in query/answer columns
   - Consider different column combinations
   - Verify the metric type matches your use case

### Performance Tips

1. **Start small**: Test with `--limit 10` first
2. **Choose relevant columns**: Include text fields that contain meaningful information
3. **Balance data**: Ensure good train/test split with sufficient data
4. **Iterate**: Try different combinations and metrics

## 🚀 Next Steps

1. **Run multiple tests**: Try different metrics and column combinations
2. **Analyze patterns**: Look for which column types perform best
3. **Optimize your RAG system**: Use insights to improve your embeddings
4. **Share results**: Export JSON for further analysis
5. **Scale up**: Test on larger datasets with more combinations

## 📝 Configuration File

After running `rag-test configure`, a `.rag-config.json` file is created:

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

You can edit this file directly or use environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `EMBEDDING_MODEL`
- `OUTPUT_PATH`

## 🎉 You're Ready!

Your RAG CLI Tester is now ready to help you optimize your retrieval system. Start with simple tests and gradually explore more complex scenarios to find the best embedding strategy for your specific use case.
