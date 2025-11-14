import fs from 'fs';
import path from 'path';

// Configuration
const INPUT_FOLDER = './input_files';
const OUTPUT_FOLDER = './cleaned_files';

// Create output folder if it doesn't exist
if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

function cleanSQL(sqlContent) {
    let cleaned = sqlContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

    cleaned = cleaned.replace(
        /^\s*CREATE\s+OR\s+REPLACE\s+TABLE\s+\S+[\s\S]*?\bAS\b\s*/i,
        ''
    );

    cleaned = cleaned
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/;\s*$/, '');

    return cleaned;
}


// function cleanSQL(sqlContent) {
//     let cleaned = sqlContent
//         .replace(/--.*$/gm, '')
//         .replace(/\/\*[\s\S]*?\*\//g, '');

//     cleaned = cleaned.replace(/^\s*CREATE\s+OR\s+REPLACE\s+TABLE\s+\S+\s+AS\s*/is, '');

//     cleaned = cleaned
//         .replace(/\r?\n/g, ' ')
//         .replace(/\s+/g, ' ')
//         .trim();

//     cleaned = cleaned.replace(/;\s*$/, '');

//     return cleaned;
// }

function processFiles() {
    try {
        // Read all files from input folder
        const files = fs.readdirSync(INPUT_FOLDER);

        let processedCount = 0;
        let errorCount = 0;

        files.forEach(file => {
            // Process only .sql files
            if (path.extname(file).toLowerCase() === '.sql') {
                try {
                    const inputPath = path.join(INPUT_FOLDER, file);
                    const outputPath = path.join(OUTPUT_FOLDER, file);

                    // Read the SQL file
                    const sqlContent = fs.readFileSync(inputPath, 'utf8');

                    // Clean the SQL
                    const cleanedSQL = cleanSQL(sqlContent);

                    // Write to output folder
                    fs.writeFileSync(outputPath, cleanedSQL, 'utf8');

                    console.log(`✓ Processed: ${file}`);
                    processedCount++;
                } catch (err) {
                    console.error(`✗ Error processing ${file}:`, err.message);
                    errorCount++;
                }
            }
        });

        console.log('\n' + '='.repeat(50));
        console.log(`Processing complete!`);
        console.log(`Files processed: ${processedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Output folder: ${OUTPUT_FOLDER}`);
        console.log('='.repeat(50));

    } catch (err) {
        console.error('Error reading input folder:', err.message);
        console.error('Make sure the input_files folder exists!');
    }
}

// Run the script
processFiles();