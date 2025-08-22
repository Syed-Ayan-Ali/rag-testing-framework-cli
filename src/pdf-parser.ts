import { PythonShell } from 'python-shell';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export interface PDFParseResult {
  success: boolean;
  outputFile?: string;
  error?: string;
}

export class PDFParser {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../scripts/pdf_parser.py');
  }

  /**
   * Parse a PDF file using pypdfium2 via python-shell
   * @param pdfPath Path to the PDF file
   * @param outputDir Output directory for parsed text files
   * @returns Promise<PDFParseResult>
   */
  async parsePDF(pdfPath: string, outputDir: string = 'parsed_output'): Promise<PDFParseResult> {
    try {
      // Validate input
      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }

      // Check if Python script exists
      if (!fs.existsSync(this.pythonScriptPath)) {
        return {
          success: false,
          error: `Python script not found: ${this.pythonScriptPath}`
        };
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Run the Python script using python-shell
      const result = await this.runPythonScript(pdfPath, outputDir);
      
      if (result.success) {
        // Find the output file
        const pdfName = path.basename(pdfPath, path.extname(pdfPath));
        const outputFile = path.join(outputDir, `${pdfName}.txt`);
        
        if (fs.existsSync(outputFile)) {
          return {
            success: true,
            outputFile: outputFile
          };
        } else {
          return {
            success: false,
            error: 'Python script completed but output file not found'
          };
        }
      } else {
        return {
          success: false,
          error: result.error || 'Python script execution failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run the Python script using python-shell
   */
  private async runPythonScript(pdfPath: string, outputDir: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Python script execution timed out after 30 seconds'
        });
      }, 30000); // 30 second timeout

      const options = {
        mode: 'text' as const,
        pythonPath: 'python',
        pythonOptions: ['-u'], // unbuffered stdout
        scriptPath: path.dirname(this.pythonScriptPath),
        args: [pdfPath, '-o', outputDir]
      };

      const scriptName = path.basename(this.pythonScriptPath);
      
      console.log(`  🔧 Executing Python script: ${scriptName}`);
      console.log(`  📁 Script path: ${options.scriptPath}`);
      console.log(`  🐍 Python path: ${options.pythonPath}`);
      console.log(`  📄 Arguments: ${options.args.join(' ')}`);
      
      PythonShell.run(scriptName, options)
        .then(() => {
          clearTimeout(timeout);
          console.log('  ✅ Python script completed successfully');
          resolve({
            success: true
          });
        })
        .catch((err: any) => {
          clearTimeout(timeout);
          console.log(`  ❌ Python script failed: ${err.message || err}`);
          resolve({
            success: false,
            error: `Python execution failed: ${err.message || err}`
          });
        });
    });
  }

  /**
   * Check if the PDF parser is available (Python and pypdfium2)
   */
  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      // Check if Python script exists
      if (!fs.existsSync(this.pythonScriptPath)) {
        return {
          available: false,
          error: `Python script not found: ${this.pythonScriptPath}`
        };
      }

      // Check if Python is available
      try {
        execSync('python --version', { stdio: 'pipe' });
      } catch (error) {
        try {
          // Try python3 as fallback
          execSync('python3 --version', { stdio: 'pipe' });
        } catch (error3) {
          return {
            available: false,
            error: 'Python is not installed or not in PATH. Please install Python and ensure it\'s available as "python" or "python3"'
          };
        }
      }

      // Check if pypdfium2 is available in the client's environment
      try {
        execSync('python -c "import pypdfium2"', { stdio: 'pipe' });
      } catch (error) {
        try {
          // Try python3 as fallback
          execSync('python3 -c "import pypdfium2"', { stdio: 'pipe' });
        } catch (error3) {
          return {
            available: false,
            error: 'pypdfium2 is not installed in your Python environment. Please run: pip install pypdfium2'
          };
        }
      }

      return {
        available: true
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if pypdfium2 is installed and offer to install it
   */
  async ensurePypdfium2(): Promise<{ success: boolean; error?: string }> {
    try {
      // First check if it's already installed
      const availability = await this.checkAvailability();
      if (availability.available) {
        return { success: true };
      }

      // If not available due to pypdfium2, return installation instructions
      if (availability.error?.includes('pypdfium2')) {
        return {
          success: false,
          error: 'Please install pypdfium2 in your Python environment:\n  pip install pypdfium2\n  or\n  python -m pip install pypdfium2'
        };
      }

      return {
        success: false,
        error: availability.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
