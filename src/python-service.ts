import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class PythonService {
  private static readonly PDF_PARSER_SCRIPT = `
import sys
import os
import json
import traceback

try:
    import pypdfium2 as pdfium
except ImportError:
    print(json.dumps({
        'success': False,
        'error': "ModuleNotFoundError: No module named 'pypdfium2'",
        'traceback': "Please install pypdfium2: pip install pypdfium2>=4.0.0"
    }))
    sys.exit(1)

def extract_text_from_pdf(pdf_path: str, output_path: str) -> dict:
    try:
        # Open the PDF file
        pdf = pdfium.PdfDocument(pdf_path)

        # Get basic PDF information
        info = pdf.get_metadata_dict()
        page_count = len(pdf)

        print(f"Processing PDF: {os.path.basename(pdf_path)}", file=sys.stderr)
        print(f"Pages: {page_count}", file=sys.stderr)

        extracted_text = ""

        # Extract text from each page
        for page_number in range(page_count):
            page = pdf.get_page(page_number)

            # Extract text from the page
            text = page.get_textpage().get_text_range()

            if text.strip():  # Only add non-empty pages
                extracted_text += f"\\n=== Page {page_number + 1} ===\\n\\n"
                extracted_text += text
                extracted_text += "\\n"

            page.close()

        pdf.close()

        # Save the extracted text
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(extracted_text)

        return {
            'success': True,
            'pages': page_count,
            'text_length': len(extracted_text),
            'output_path': output_path,
            'metadata': info
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def main():
    if len(sys.argv) != 3:
        print("Usage: python script.py <pdf_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]

    # Validate input file
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if not pdf_path.lower().endswith('.pdf'):
        print("Error: Input file must be a PDF", file=sys.stderr)
        sys.exit(1)

    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Extract text from PDF
    result = extract_text_from_pdf(pdf_path, output_path)

    # Output result as JSON for Node.js to parse
    print(json.dumps(result))

    if not result['success']:
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  private static getPythonCommand(): Promise<{success: boolean, command: string}> {
    return new Promise((resolve) => {
      const checkPython3 = spawn('python3', ['--version']);
      checkPython3.on('close', (code) => {
        if (code === 0) resolve({success: true, command: 'python3'});
      });
      checkPython3.on('error', () => {
        const checkPython = spawn('python', ['--version']);
        checkPython.on('close', (code) => {
          if (code === 0) resolve({success: true, command: 'python'});
          else resolve({success: false, command: ''});
        });
        checkPython.on('error', () => resolve({success: false, command: ''}));
      });
    });
  }

  static async parsePDF(pdfPath: string, outputPath: string): Promise<any> {
    const pythonCheck = await this.getPythonCommand();

    if (!pythonCheck.success) {
      throw new Error('Python is required but not found. Please install Python 3.7+');
    }

    return new Promise((resolve, reject) => {
      // Create a temporary Python script file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempScriptPath = path.join(tempDir, 'pdf_parser_temp.py');
      fs.writeFileSync(tempScriptPath, this.PDF_PARSER_SCRIPT, 'utf8');

      const pythonProcess = spawn(pythonCheck.command, [tempScriptPath, pdfPath, outputPath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse Python script output'));
          }
        } else {
          reject(new Error(stderr || `Python script exited with code ${code}`));
        }
      });

      pythonProcess.on('error', (error) => {
        // Clean up temp file on error too
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(error);
      });
    });
  }
}
