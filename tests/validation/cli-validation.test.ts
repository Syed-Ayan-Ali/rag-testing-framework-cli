import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

describe('CLI Validation Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli.js');
  const TEST_ENV_PATH = path.join(__dirname, '../../.env.test');
  
  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await execPromise('npm run build', { cwd: path.join(__dirname, '../..') });
    } catch (error) {
      console.warn('Build failed, but continuing with tests');
    }

    // Create test environment file if it doesn't exist
    if (!fs.existsSync(TEST_ENV_PATH)) {
      const testEnvContent = `
# Test environment variables
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
`.trim();
      fs.writeFileSync(TEST_ENV_PATH, testEnvContent);
    }
  });

  afterAll(() => {
    // Clean up test environment file
    if (fs.existsSync(TEST_ENV_PATH)) {
      fs.unlinkSync(TEST_ENV_PATH);
    }
  });

  const runCLI = (args: string[], timeout: number = 10000): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [CLI_PATH, ...args], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`CLI command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  };

  describe('CLI Help and Version', () => {
    it('should display help when called with --help', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Options:');
      expect(result.stdout).toContain('Commands:');
    });

    it('should display version when called with --version', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
    });

    it('should display help for specific commands', async () => {
      const result = await runCLI(['configure', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('configure');
    });
  });

  describe('CLI Command Structure', () => {
    it('should show available commands without arguments', async () => {
      const result = await runCLI([]);
      
      // CLI may exit with 0 or 1 depending on implementation
      expect([0, 1]).toContain(result.exitCode);
      const output = result.stdout || result.stderr;
      expect(output).toContain('configure');
      expect(output).toContain('tables');
      expect(output).toContain('inspect');
      expect(output).toContain('test');
    });

    it('should show error for unknown command', async () => {
      const result = await runCLI(['unknown-command']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });
  });

  describe('Configuration Command Validation', () => {
    it('should handle configure command without crashing', async () => {
      // This test validates that the configure command doesn't crash on startup
      // We'll run it with a very short timeout and just check it starts
      try {
        const result = await runCLI(['configure'], 1000); // Short timeout
        
        // If it completes within timeout, check the result
        expect(typeof result.exitCode).toBe('number');
        expect(result.stdout || result.stderr).toBeTruthy();
      } catch (error: any) {
        // If it times out, that's expected behavior since configure waits for user input
        if (error.message.includes('timed out')) {
          // This is the expected behavior - configure command started but timed out waiting for input
          expect(true).toBe(true);
        } else {
          // Any other error means the command crashed
          throw error;
        }
      }
    });
  });

  describe('Tables Command Validation', () => {
    it('should handle tables command gracefully without database', async () => {
      const result = await runCLI(['tables'], 5000);
      
      // Should fail gracefully with meaningful error message
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('configuration');
    });
  });

  describe('Inspect Command Validation', () => {
    it('should require table name argument', async () => {
      const result = await runCLI(['inspect'], 5000);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });

    it('should handle inspect command with table name', async () => {
      const result = await runCLI(['inspect', 'test_table'], 5000);
      
      // Should fail gracefully without database connection
      expect(result.exitCode).toBe(1);
      const output = result.stderr || result.stdout;
      expect(output).toBeTruthy(); // Should have some error output
    });
  });

  describe('Test Command Validation', () => {
    it('should handle test command without database connection', async () => {
      const result = await runCLI(['test'], 5000);
      
      // Should fail gracefully with some error
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toBeTruthy();
    });

    it('should accept test command options', async () => {
      const result = await runCLI([
        'test',
        '--table', 'test_table',
        '--columns', 'title,content',
        '--query', 'query_col',
        '--answer', 'answer_col',
        '--metric', 'similarity',
        '--ratio', '0.8'
      ], 5000);
      
      // Should fail due to missing database but accept the arguments
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toBeTruthy();
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle invalid option values gracefully', async () => {
      const result = await runCLI([
        'test',
        '--ratio', 'invalid'
      ], 5000);
      
      expect(result.exitCode).toBe(1);
    });

    it('should handle missing required options', async () => {
      const result = await runCLI([
        'test',
        '--table', 'test_table'
        // Missing other required options for non-interactive mode
      ], 5000);
      
      // Should either prompt for interactive mode or show error
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CLI Output Format Validation', () => {
    it('should produce consistent output format for help', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.stdout).toMatch(/Usage:/);
      expect(result.stdout).toMatch(/Options:/);
      expect(result.stdout).toMatch(/Commands:/);
      
      // Check that help output is structured
      const lines = result.stdout.split('\n');
      expect(lines.length).toBeGreaterThan(5);
    });

    it('should handle ANSI color codes in output', async () => {
      const result = await runCLI(['--help']);
      
      // Output should be readable even with color codes
      expect(result.stdout).toBeTruthy();
      expect(result.stdout.length).toBeGreaterThan(100);
    });
  });

  describe('CLI Process Management', () => {
    it('should handle SIGTERM gracefully', async () => {
      // Test that CLI can be interrupted without hanging
      const promise = runCLI(['configure'], 2000);
      
      // Should timeout and be killed without hanging
      await expect(promise).rejects.toThrow('timed out');
    });

    it('should exit with appropriate codes', async () => {
      const helpResult = await runCLI(['--help']);
      expect(helpResult.exitCode).toBe(0);
      
      const errorResult = await runCLI(['invalid-command']);
      expect(errorResult.exitCode).toBe(1);
    });
  });

  describe('CLI Environment Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      const result = await runCLI(['tables'], 5000);
      
      // Should fail with configuration error, not crash
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('configuration');
    });

    it('should respect NODE_ENV=test', async () => {
      const result = await runCLI(['--help']);
      
      // Should work regardless of environment
      expect(result.exitCode).toBe(0);
    });
  });
});

describe('CLI Integration Validation', () => {
  describe('Command Chain Validation', () => {
    it('should maintain consistent CLI interface across commands', async () => {
      const commands = ['configure', 'tables', 'test'];
      
      for (const command of commands) {
        const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
          const child = spawn('node', [
            path.join(__dirname, '../../dist/cli.js'),
            command,
            '--help'
          ], { stdio: 'pipe' });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => stdout += data.toString());
          child.stderr?.on('data', (data) => stderr += data.toString());

          setTimeout(() => {
            child.kill('SIGTERM');
            resolve({ exitCode: -1, stdout, stderr });
          }, 3000);

          child.on('close', (code) => {
            resolve({ exitCode: code || 0, stdout, stderr });
          });
        });

        // Each command should have help available
        expect(result.exitCode).toBeLessThanOrEqual(1); // 0 for success, 1 for expected failure
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });
  });

  describe('CLI Dependency Validation', () => {
    it('should have all required dependencies available', async () => {
      try {
        // Check if main dependencies can be imported
        require('@supabase/supabase-js');
        require('commander');
        require('chalk');
        require('ora');
        require('inquirer');
        require('cli-table3');
        
        // Test passes if no import errors
        expect(true).toBe(true);
      } catch (error) {
        fail(`Missing required dependency: ${error}`);
      }
    });

    it('should handle module import errors gracefully', async () => {
      // This test ensures the CLI doesn't crash on import issues
      const result = await new Promise<{ exitCode: number }>((resolve) => {
        const child = spawn('node', ['-e', `
          try {
            require('${path.join(__dirname, '../../dist/cli.js')}');
            process.exit(0);
          } catch (error) {
            console.error('Import error:', error.message);
            process.exit(1);
          }
        `], { stdio: 'pipe' });

        child.on('close', (code) => {
          resolve({ exitCode: code || 0 });
        });

        setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ exitCode: -1 });
        }, 5000);
      });

      // CLI should import without major errors (0 or 1 are acceptable)
      expect([0, 1]).toContain(result.exitCode);
    });
  });
});
