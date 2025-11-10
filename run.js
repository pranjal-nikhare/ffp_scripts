
import fs from 'fs/promises';
import path from 'path';

// Get the project's root directory
const projectRoot = process.cwd();

// Get session token from command line arguments
const sessionToken = process.argv[2];

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
        console.log(`Processed: ${srcPath} -> ${destPath}`);
    } catch (err) {
        console.error(`Error processing ${srcPath}: ${err.message}`);
    }
}

/**
 * Recursively traverse the input directory and process files.
 */
async function traverseAndProcess(currentDir) {
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
            await traverseAndProcess(srcPath);
        } else if (entry.isFile()) {
            await processFile(srcPath, destPath);
        }
    }
}

(async () => {
    try {
        await fs.mkdir(outputDir, { recursive: true });
        await traverseAndProcess(inputDir);
        console.log(`All files processed for session ${sessionToken}.`);
    } catch (err) {
        console.error('Unexpected error:', err.message);
    }
})();
