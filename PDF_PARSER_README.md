# PDF Parser for RAG CLI Tester

This feature adds PDF parsing capabilities to your RAG CLI Tester using the `pypdfium2` Python library. It allows you to extract text from PDF documents and save them as text files for further processing in your RAG applications.

## Features

- **Cross-platform support**: Works on Windows, macOS, and Linux
- **Automatic dependency management**: Checks and installs required Python packages
- **Batch processing**: Process multiple PDFs efficiently
- **Text extraction**: Extracts text while preserving page structure
- **Output customization**: Configurable output directory and file naming

## Prerequisites

### 1. Python Installation
- Python 3.6 or higher must be installed on your system
- Python must be available in your system PATH
- Verify with: `python --version` or `python3 --version`

### 2. System Requirements
- **All platforms**: Node.js 18+ (for the npm package)
- **Python**: 3.6 or higher must be installed and in PATH
- **pypdfium2**: Python library for PDF processing
- Sufficient disk space for output files

## Installation

### Prerequisites
Since this is an npm package, users need to have Python and pypdfium2 installed in their environment:

```bash
# Install Python dependencies in your environment
pip install pypdfium2

# Or use the requirements file
pip install -r requirements.txt
```

### Environment Check
The PDF parser will automatically check for dependencies before execution:

```bash
# Check if everything is set up correctly
rag-test parse-pdf --check
```

If pypdfium2 is not installed, the tool will provide clear instructions for installation.

## Usage

### Basic PDF Parsing

```bash
# Parse a single PDF file
rag-test parse-pdf document.pdf

# Parse with custom output directory
rag-test parse-pdf document.pdf -o custom_output
```

### Check Parser Status

```bash
# Verify the PDF parser is working
rag-test parse-pdf --check
```

### Command Options

- `pdf-path`: Path to the PDF file (required)
- `-o, --output-dir`: Output directory (default: `parsed_output`)
- `--check`: Check parser availability without processing files

## Output

### File Structure
```
rag-cli-tester/
├── parsed_output/          # Default output directory
│   ├── document1.txt       # Extracted text from document1.pdf
│   ├── document2.txt       # Extracted text from document2.pdf
│   └── README.md           # Usage instructions
├── scripts/
│   ├── pdf_parser.py       # Python PDF parsing script
│   ├── parse-pdf.ps1       # Windows PowerShell script
│   └── parse-pdf.sh        # Unix/Linux bash script
└── src/
    └── pdf-parser.ts       # Node.js PDF parser interface
```

### Output Format
Each parsed PDF creates a text file with:
- Page-by-page text extraction
- Page number markers (`--- Page X ---`)
- UTF-8 encoding
- Preserved text formatting where possible

### Example Output
```
--- Page 1 ---
Document Title

This is the first page of the document.
It contains the introduction and main content.

--- Page 2 ---
Chapter 1: Getting Started

This chapter covers the basics...
```

## Architecture

### How It Works
1. **Node.js CLI** receives the parse command
2. **PDFParser class** checks the client's Python environment
3. **python-shell** package executes the Python script directly
4. **Python script** uses pypdfium2 to extract text from the client's environment
5. **Output** is saved to the specified directory

### Cross-Platform Support
- **All platforms**: Uses `python-shell` npm package for direct Python execution
- **No shell scripts**: Direct Python execution eliminates cross-platform script issues
- **Environment detection**: Automatically detects Python and pypdfium2 availability

## Troubleshooting

### Common Issues

#### 1. Python Not Found
```
Error: Python is not installed or not in PATH
```
**Solution**: Install Python and ensure it's in your system PATH

#### 2. pypdfium2 Not Installed
```
Error: Failed to install pypdfium2
```
**Solution**: 
```bash
pip install pypdfium2
# Or
python -m pip install pypdfium2
```

#### 3. Permission Denied (Unix/Linux)
```
Error: Permission denied
```
**Solution**: Make scripts executable
```bash
chmod +x scripts/parse-pdf.sh
```

#### 4. PowerShell Execution Policy (Windows)
```
Error: Cannot load file because running scripts is disabled
```
**Solution**: Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Debug Mode
To see detailed error information, check the script output:
```bash
# Windows
powershell -ExecutionPolicy Bypass -File scripts/parse-pdf.ps1 document.pdf

# Unix/Linux
bash scripts/parse-pdf.sh document.pdf
```

## Advanced Usage

### Batch Processing
Process multiple PDFs in a loop:

```bash
# Windows PowerShell
Get-ChildItem *.pdf | ForEach-Object { rag-test parse-pdf $_.FullName }

# Unix/Linux
for file in *.pdf; do rag-test parse-pdf "$file"; done
```

### Custom Python Environment
If you're using a virtual environment:

```bash
# Activate your virtual environment first
source venv/bin/activate  # Unix/Linux
# or
venv\Scripts\activate     # Windows

# Then run the parser
rag-test parse-pdf document.pdf
```

### Integration with RAG Pipeline
The extracted text files can be used as input for your RAG testing:

1. Parse PDFs to get text content
2. Use the text files for embedding generation
3. Test different text chunking strategies
4. Evaluate RAG performance with real document content

## Performance Considerations

- **Large PDFs**: Processing time scales with document size and complexity
- **Memory usage**: pypdfium2 is memory-efficient for most documents
- **Batch processing**: Consider system resources when processing many files
- **Output size**: Text files are typically much smaller than source PDFs

## Security Notes

- The parser only extracts text content, not executable code
- PDF files are processed locally, no data is sent to external services
- Shell scripts use safe execution practices
- Input validation prevents path traversal attacks

## Contributing

To enhance the PDF parser:

1. **Python script**: Modify `scripts/pdf_parser.py` for parsing logic
2. **Shell scripts**: Update `scripts/parse-pdf.ps1` and `scripts/parse-pdf.sh`
3. **Node.js interface**: Enhance `src/pdf-parser.ts` for additional features
4. **Testing**: Add tests in the `tests/` directory

## License

This PDF parser feature follows the same license as the main RAG CLI Tester project.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run `rag-test parse-pdf --check` to diagnose problems
3. Review the script output for detailed error messages
4. Ensure all prerequisites are met
