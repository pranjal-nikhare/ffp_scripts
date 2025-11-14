import fs from "fs";
import path from "path";

const sqlFilePath = "./parameterize_tables/input_files/01_CBT_IMMUN_GASTRO_SALES_ITMD.sql"; // change as needed

function extractDBTables(sql) {
  // Normalize SQL
  const normalized = sql
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/--.*?(\r?\n|$)/g, " ") // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, " "); // remove block comments

  const results = new Set();

  // Regex: looks for FROM or JOIN followed by schema.table pattern
  // We only capture full db.table references (alphanumeric, underscore allowed)
  const regex = /\b(?:FROM|JOIN)\s+([A-Z0-9_]+)\.([A-Z0-9_]+)/gi;

  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const fullName = `${match[1]}.${match[2]}`;
    results.add(fullName);
  }

  return Array.from(results);
}

(async () => {
  const sql = await fs.promises.readFile(sqlFilePath, "utf8");
  const dbTables = extractDBTables(sql);
  console.log("Extracted DB Tables:", dbTables);
})();
