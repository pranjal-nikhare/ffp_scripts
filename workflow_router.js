import express from 'express';
import { format } from "sql-formatter";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import archiver from "archiver";

// import { scheduleCleanup } from './index.js';
import { scheduleCleanup } from './utils.js';

import { get_calculation_attributes_count } from './get_json_data.js';
import { get_file_name } from './get_json_data.js';
import { get_query } from './get_json_data.js';
// import { formatSql } from './sql_formatter.js';
import { processFile } from './temp.js';
import { validateJsonFile } from './utils/json_validator_formatter.js';

const router = express.Router();

const projectRoot = process.cwd();

//for the workfloowh
const storage_module2 = multer.diskStorage({
  destination: async (req, file, cb) => {
    const token = req.session_token;
    const dir = path.join(projectRoot, 'module2_files', 'input_files', token);
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

// const upload = multer({ storage: storage_module2 });
const upload_module2 = multer({ storage: storage_module2 });

// Upload Route for module 2
// router.post('/upload_module2', upload_module2.array('files', 25), (req, res) => {
//   scheduleCleanup(req.session_token);
//   res.json({ success: true, message: 'Files uploaded for module-2 successfully' });
// });

// Upload Route for module 2
router.post('/upload_module2', (req, res) => {
  try {
    upload_module2.array('files', 25)(req, res, async (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }

      try {
        // Validate all uploaded JSON files
        for (const file of req.files || []) {
          const check = await validateJsonFile(file.path);

          if (!check.valid) {
            console.error(`❌ Validation failed for ${file.originalname}:`, check.error);

            return res.status(400).json({
              success: false,
              message: `Uhh! Invalid JSON file (${file.originalname}): ${check.error}`
            });
          }
        }

        // If all files are valid
        scheduleCleanup(req.session_token);

        return res.json({
          success: true,
          message: 'Files uploaded and validated successfully'
        });

      } catch (innerErr) {
        console.error("Processing Error:", innerErr);
        return res.status(500).json({
          success: false,
          message: 'Internal server error while processing files'
        });
      }
    });

  } catch (outerErr) {
    console.error("Unexpected Error:", outerErr);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error'
    });
  }
});


// GET /users
router.get("/", (req, res) => {
  res.sendFile(path.join(projectRoot, './workflow.html'))
});

// Reverse variable conversion: {var}  →  $var
export function reverseVariables(sqlText) {
  if (!sqlText || typeof sqlText !== "string") return sqlText;

  // Replace {VAR} with $VAR
  return sqlText.replace(/\{([A-Za-z0-9_]+)\}/g, (_, varName) => {
    return `$${varName}`;
  });
}

// Remove prefix before first double underscore: (a__b -> b) ---> this one is for individual word
// export function removeDoubleUnderscorePrefix(str) {
//   if (!str || typeof str !== "string") return str;

//   // If no "__" exists, return original
//   if (!str.includes("__")) return str;

//   // Split only at the FIRST occurrence of "__"
//   return str.split(/__(.+)/)[1];
// }


export function removeDoubleUnderscorePrefix(text) {
  if (!text || typeof text !== "string") return text;

  // Replace ANYTHING__SOMETHING with SOMETHING
  return text.replace(/([A-Za-z0-9_]+)__([A-Za-z0-9_]+)/g, "$2");
}

router.post("/process_module2", async (req, res) => {
  const token = req.session_token;

  const inputDir = path.join(
    projectRoot,
    "module2_files",
    "input_files",
    token
  );
  
  // This folder will contain the generated SQL files we want to zip
  const outputDir = path.join(
    projectRoot,
    "module2_files",
    "output_files",
    token
  );

  try {
    const files = await fs.readdir(inputDir);

    for (const file of files) {
      const inputFile = path.join(inputDir, file);
      const jsonData = JSON.parse(await fs.readFile(inputFile, "utf8"));
      const mainName = jsonData.definition?.name || file.replace(".json", "");
      
      const folderPath = path.join(outputDir, mainName);
      await fs.mkdir(folderPath, { recursive: true });

      const count = await get_calculation_attributes_count(inputFile);

      for (let i = 1; i < count; i++) {
        const queryObj = await get_query(inputFile, i);
        const fileNameObj = await get_file_name(inputFile, i);

        let attribute = fileNameObj[`calculation_attributes.${i}.attribute`];
        let query = queryObj[`calculation_attributes.${i}.value.query`];

        if (!attribute || !query) continue;

        attribute = removeDoubleUnderscorePrefix(attribute);

        query = reverseVariables(query);

        const tempFilePath = path.join(folderPath, `_temp_${attribute}.sql`);
        await fs.writeFile(tempFilePath, query, "utf8");

        // 3️⃣ Format
        const result = await processFile(tempFilePath);
        await fs.unlink(tempFilePath);

        const finalSql = result?.formatted || query;
        const sqlFilePath = path.join(folderPath, `${attribute}.sql`);

        // 5️⃣ Save formatted SQL
        await fs.writeFile(sqlFilePath, finalSql, "utf8");
      }
    }

    res.attachment(`processed_files_${token}.zip`);
    

    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level
    });

    // Good practice: handle archive warnings/errors
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn(err);
      } else {
        throw err;
      }
    });

    archive.on('error', function(err) {
      console.error("Archiver error:", err);
      res.status(500).send({ error: err.message });
    });

    // Pipe the archive data to the response
    archive.pipe(res);

    // Append the entire output directory to the zip
    // 'false' as the second argument ensures files are put at the root of the zip 
    // or preserves the structure inside outputDir correctly without adding 'outputDir' as a parent folder
    archive.directory(outputDir, false); 

    // Finalize the archive (this finishes the stream)
    await archive.finalize();

    // Note: Do not use res.send() here, as archive.pipe(res) handles the response.

  } catch (err) {
    console.error("Error processing files:", err);
    // Only send error header if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).send("Error processing files");
    }
  }
});

router.post('/set_variables', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, result: 'No JSON received' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return res.status(400).json({ success: false, result: 'Invalid JSON format' });
    }

    if (!Array.isArray(parsed) || !parsed[0]?.params?.sql_params) {
      return res.status(400).json({
        success: false,
        result: 'JSON does not contain params.sql_params structure'
      });
    }

    const sqlParams = parsed[0].params.sql_params;
    let output = '';

    for (const [key, value] of Object.entries(sqlParams)) {
      let raw = value;

      // CASE 1: 'wrapped in single quotes'
      // Example: "'TOTAL'"  → TOTAL → SET key = 'TOTAL';
      if (/^'.*'$/.test(raw)) {
        const clean = raw.slice(1, -1);
        output += `SET ${key} = '${clean}';\n`;
        continue;
      }

      // CASE 2: Numeric
      if (!isNaN(raw)) {
        output += `SET ${key} = ${raw};\n`;
        continue;
      }

      // CASE 3: Plain identifier (no quotes)
      output += `SET ${key} = ${raw};\n`;
    }

    return res.json({ success: true, result: output });

  } catch (err) {
    return res.status(500).json({ success: false, result: 'Internal Server Error' });
  }
});


// router.post('/set_variables', async (req, res) => {
//   try {
//     const { text } = req.body;
//     if (!text) {
//       return res.status(400).json({ success: false, result: 'No JSON received' });
//     }

//     let parsed;
//     try {
//       parsed = JSON.parse(text);
//     } catch (err) {
//       return res.status(400).json({ success: false, result: 'Invalid JSON format' });
//     }

//     if (!Array.isArray(parsed) || !parsed[0]?.params?.sql_params) {
//       return res.status(400).json({
//         success: false,
//         result: 'JSON does not contain params.sql_params structure'
//       });
//     }

//     const sqlParams = parsed[0].params.sql_params;
//     let output = '';

//     for (const [key, value] of Object.entries(sqlParams)) {
//       let finalValue = value;

//       // CASE 1: value already contains single quotes → remove them
//       if (/^'.*'$/.test(finalValue)) {
//         finalValue = finalValue.slice(1, -1);
//         output += `SET ${key} = '${finalValue}';\n`;
//         continue;
//       }

//       // CASE 2: numeric → use number
//       if (!isNaN(finalValue)) {
//         output += `SET ${key} = ${finalValue};\n`;
//         continue;
//       }

//       // CASE 3: all other strings → wrap in single quotes
//       output += `SET ${key} = '${finalValue}';\n`;
//     }

//     return res.json({ success: true, result: output });

//   } catch (err) {
//     return res.status(500).json({ success: false, result: 'Internal Server Error' });
//   }
// });




// GET /users/:id
// router.get("/2", (req, res) => {
//   res.send(`User with ID: `);
// });


export default router;
