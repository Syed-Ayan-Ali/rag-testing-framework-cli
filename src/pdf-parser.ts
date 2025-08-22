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
    // Fix path resolution for both development and production builds
    const baseDir = __dirname.includes('dist') 
      ? path.join(__dirname, '../scripts')  // Production build
      : path.join(__dirname, 'scripts');    // Development
    this.pythonScriptPath = path.join(baseDir, 'pdf_parser.py');
    
    // Debug logging
    console.log(`  🔍 PDF Parser initialized`);
    console.log(`  📁 Base directory: ${baseDir}`);
    console.log(`  🐍 Python script path: ${this.pythonScriptPath}`);
    console.log(`  ✅ Script exists: ${require('fs').existsSync(this.pythonScriptPath)}`);
  }

  /**
   * Parse a PDF file using pypdfium2 via python-shell
   * @param pdfPath Path to the PDF file
   * @param outputDir Output directory for parsed text files
   * @returns Promise<PDFParseResult>
   */
  async parsePDF(pdfPath: string, outputDir: string = 'parsed_output'): Promise<PDFParseResult> {
    try {
      console.log(`  🔍 Starting PDF parsing process...`);
      
      // Validate input
      console.log(`  📄 Validating PDF file: ${pdfPath}`);
      if (!fs.existsSync(pdfPath)) {
        console.log(`  ❌ PDF file not found`);
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }
      console.log(`  ✅ PDF file exists`);

      // Check if Python script exists
      console.log(`  🐍 Checking Python script: ${this.pythonScriptPath}`);
      if (!fs.existsSync(this.pythonScriptPath)) {
        console.log(`  ❌ Python script not found`);
        return {
          success: false,
          error: `Python script not found: ${this.pythonScriptPath}`
        };
      }
      console.log(`  ✅ Python script exists`);

      // Ensure output directory exists
      console.log(`  📁 Creating output directory: ${outputDir}`);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`  ✅ Output directory created`);
      } else {
        console.log(`  ✅ Output directory already exists`);
      }

      console.log(`  🚀 Starting Python script execution...`);
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
      try {
        console.log(`  🔧 Setting up Python script execution...`);
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.log(`  ⏰ Timeout reached - Python script execution timed out after 30 seconds`);
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
        
        console.log(`  🚀 Calling PythonShell.run()...`);
        
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
      } catch (error) {
        console.log(`  💥 Error in runPythonScript setup: ${error}`);
        resolve({
          success: false,
          error: `Setup error: ${error}`
        });
      }
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
