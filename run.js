import fs from 'fs/promises';
import path from 'path';

// Get the project's root directory
const projectRoot = process.cwd();

// Get session token and mode from command line arguments
const sessionToken = process.argv[2];
const mode = process.argv[3] || 'forward'; // 'forward' or 'reverse'

if (!sessionToken) {
    console.error('Error: Session token not provided.');
    process.exit(1);
}

const inputDir = path.join(projectRoot, 'input_files', sessionToken);
const outputDir = path.join(projectRoot, 'out', sessionToken);

/**
 * Read a file, replace $variable with {variable}, and write to destination path.
 */
async function processFile(srcPath, destPath) {
    try {
        const content = await fs.readFile(srcPath, 'utf8');
        const updated = content.replace(/\$(\w+)/g, '{$1}');
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, updated, 'utf8');
        console.log(`Processed (forward): ${srcPath} -> ${destPath}`);
    } catch (err) {
        console.error(`Error processing ${srcPath}: ${err.message}`);
    }
}

/**
 * Read a file, replace {variable} with $variable, and write to destination path.
 */
async function reverseProcessFile(srcPath, destPath) {
    try {
        const content = await fs.readFile(srcPath, 'utf8');
        const updated = content.replace(/\{(\w+)\}/g, '\$$1');
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, updated, 'utf8');
        console.log(`Processed (reverse): ${srcPath} -> ${destPath}`);
    } catch (err) {
        console.error(`Error processing ${srcPath}: ${err.message}`);
    }
}

/**
 * Recursively traverse the input directory and process files.
 */
async function traverseAndProcess(currentDir, processFn) {
    let entries;
    try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
        console.error(`Error reading directory ${currentDir}: ${err.message}`);
        return;
    }

    for (const entry of entries) {
        const srcPath = path.join(currentDir, entry.name);
        const relPath = path.relative(inputDir, srcPath);
        const destPath = path.join(outputDir, relPath);

        if (entry.isDirectory()) {
            await traverseAndProcess(srcPath, processFn);
        } else if (entry.isFile()) {
            await processFn(srcPath, destPath);
        }
    }
}

(async () => {
    try {
        // Check if input directory exists
        try {
            await fs.access(inputDir);
            console.log(`Input directory found: ${inputDir}`);
        } catch (err) {
            console.error(`Input directory does not exist: ${inputDir}`);
            process.exit(1);
        }

        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Output directory created: ${outputDir}`);
        
        // Choose the processing function based on mode
        const processFn = mode === 'reverse' ? reverseProcessFile : processFile;
        const modeLabel = mode === 'reverse' ? 'REVERSE' : 'FORWARD';
        
        console.log(`Processing files in ${modeLabel} mode for session ${sessionToken}...`);
        await traverseAndProcess(inputDir, processFn);
        
        // Verify files were created
        const outputFiles = await fs.readdir(outputDir, { recursive: true });
        console.log(`Created ${outputFiles.length} file(s) in output directory`);
        
        console.log(`All files processed in ${modeLabel} mode for session ${sessionToken}.`);
    } catch (err) {
        console.error('Unexpected error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
})();