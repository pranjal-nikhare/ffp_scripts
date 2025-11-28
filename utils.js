// utils.js
import path from 'path';
import fs from 'fs/promises';

const projectRoot = process.cwd();

export const scheduleCleanup = (token) => {
  setTimeout(async () => {
    const inputDir = path.join(projectRoot, 'input_files', token);
    const outDir = path.join(projectRoot, 'out', token);
    const paramDir = path.join(projectRoot, 'parameterize_tables', 'input_files', token);
    const normalizeInputDir = path.join(projectRoot, 'normalize_sql', 'input_files', token);
    const normalizeOutputDir = path.join(projectRoot, 'normalize_sql', 'cleaned_files', token);
    const module2InputDir = path.join(projectRoot, 'module2_files', 'input_files', token);
    const module2OutputDir = path.join(projectRoot, 'module2_files', 'output_files', token);
    
    try {
      // Use force: true to avoid errors if files don't exist
      await fs.rm(inputDir, { recursive: true, force: true });
      await fs.rm(outDir, { recursive: true, force: true });
      await fs.rm(paramDir, { recursive: true, force: true });
      await fs.rm(normalizeInputDir, { recursive: true, force: true });
      await fs.rm(normalizeOutputDir, { recursive: true, force: true });
      await fs.rm(module2InputDir, { recursive: true, force: true });
      await fs.rm(module2OutputDir, { recursive: true, force: true });
      console.log(`Cleaned up files for session: ${token}`);
    } catch (error) {
      console.error(`Error cleaning up session ${token}:`, error);
    }
  }, 3 * 60 * 1000); // 3 minutes
};