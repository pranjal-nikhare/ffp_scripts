// import { format } from "sql-formatter";
// import fs from "fs/promises";

// async function extractText(filePath) {
//   try {
//     const text = await fs.readFile(filePath, "utf8");
//     // console.log(text);

//     const formatted = format (text, { language: "mysql", keywordCase: "upper" })

//     console.log(formatted);

//   } catch (err) {
//     console.error(err);
//   }
// }

// firebase login --no-localhost



// // format(
// //   text ,
// //   { language: "mysql", keywordCase: "upper" }
// // );

// // console.log(formatted);

// extractText("./module2_files/input_files/new 66.sql");


import { format } from "sql-formatter";
import fs from "fs/promises";
// import {  } from "./normalize_sql.js";

async function extractText(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    // console.log(text);

    const normalizedText = normalizeSql(text);
    const formatted = format(normalizedText, {
      language: "mysql",
      keywordCase: "upper",
    });

    console.log(formatted);
  } catch (err) {
    console.error(err);
  }
}

// format(
//   text ,
//   { language: "mysql", keywordCase: "upper" }
// );

// console.log(formatted);

extractText("./module2_files/input_files/new 66.sql");
