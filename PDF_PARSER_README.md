# PDF Parser Command

A new command has been added to your rag-cli-tester CLI tool to parse PDF files using Python's `pypdfium2` library.

## Setup Requirements

### 1. Install Python Dependencies

Before using the PDF parser, install the required Python packages:

```bash
pip install -r requirements.txt
```

Or manually install pypdfium2:

```bash
pip install pypdfium2>=4.0.0
```

### 2. Ensure Python is Available

The command requires Python 3.7+ to be installed and accessible via `python3` or `python` command.

## Usage

### Interactive Mode

```bash
rag-test parse-pdf
```

This will prompt you to:
1. Enter the path to a PDF file
2. Optionally customize the output filename

### Command Line Options

```bash
# Parse a specific PDF file
rag-test parse-pdf --file /path/to/document.pdf

# Parse with custom output name
rag-test parse-pdf --file /path/to/document.pdf --output custom-name

# Full example
rag-test parse-pdf -f ./documents/manual.pdf -o parsed-manual
```

## Features

- **Smart File Detection**: Automatically validates PDF files
- **Interactive Prompts**: User-friendly prompts when options are missing
- **Progress Indicators**: Visual feedback during parsing
- **Error Handling**: Comprehensive error messages and validation
- **Organized Output**: Files saved to `parsed_output/` directory
- **Metadata Extraction**: Captures PDF metadata (title, pages, etc.)
- **Page Separation**: Each page's text is clearly separated in output

## Output

The extracted text is saved as a `.txt` file in the `parsed_output/` directory with the following format:

```
=== Page 1 ===

[Extracted text from page 1]

=== Page 2 ===

[Extracted text from page 2]
```

## Example Output

```
✅ PDF parsing completed successfully!

📊 Extraction Summary:
  📄 Pages processed: 15
  📝 Text length: 45,892 characters
  💾 Output saved to: ./parsed_output/document.txt
  📋 Title: Sample Document
```

## Command Help

To see all available options:

```bash
rag-test parse-pdf --help
```

## Dependencies

- **Python 3.7+**: Required runtime
- **pypdfium2**: PDF parsing library
- **Node.js**: CLI framework
- **child_process**: For Python script execution

## Troubleshooting

### Python Not Found
```
❌ Python is required but not found. Please install Python 3.7+
📦 Install Python: https://www.python.org/downloads/
```

**Solution**: Install Python and ensure it's in your PATH.

### pypdfium2 Not Installed
```
❌ pypdfium2 is required but not installed.
📦 Install pypdfium2:
   pip install pypdfium2
   or
   pip install -r requirements.txt
```

**Solution**: Install the Python package using pip.

### File Not Found
```
❌ PDF file not found: /path/to/nonexistent.pdf
```

**Solution**: Check the file path and ensure the PDF exists.

### Invalid File Type
```
❌ File must be a PDF
```

**Solution**: Ensure the file has a `.pdf` extension and is a valid PDF file.
