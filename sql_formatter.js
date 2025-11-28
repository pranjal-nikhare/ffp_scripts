import { format } from "sql-formatter";
import { readFileSync } from "fs";

// ============================================
// CONFIGURATION: Set your SQL file path here
// ============================================
const FILE_LOCATION = "/home/user/express-serv/module2_files/input_files/CBT_NEURO_MIGRAINE_CALL_ACTIVITY_ITMD.sql";  // <-- Change this to your file path

/**
 * @param {string} sql 
 * @param {string} language 
 * @param {object} options 
 * @returns {string|null} 
 */
export function trySqlFormat(sql, language, options = {}) {
  try {
    const defaultOptions = {
      language: language,
      tabWidth: 2,
      useTabs: false,
      keywordCase: "upper",
      indentStyle: "standard",
      logicalOperatorNewline: "before",
      expressionWidth: 80,
      linesBetweenQueries: 2,
      ...options
    };
    
    return format(sql, defaultOptions);
  } catch (error) {
    console.error(`Failed to format with ${language} dialect:`, error.message);
    return null;
  }
}

/**
 * Main formatting function with multiple SQL dialect fallbacks.
 * Guaranteed not to crash - will always return formatted or original SQL.
 * @param {string} sql - The SQL string to format
 * @param {object} options - Formatting options
 * @returns {{formatted: string, method: string}} - Formatted SQL and method used
 */
export function formatSql(sql, options = {}) {
  // Validate input
  if (!sql || typeof sql !== 'string') {
    return { 
      formatted: sql || '', 
      method: 'none (invalid input)' 
    };
  }

  // List of SQL dialects to try in order of likelihood
  const dialects = [
    'snowflake',  // Try Snowflake first (based on your DATEADD, DATE_TRUNC syntax)
    'postgresql', // Postgres is similar to Snowflake
    'mysql',      // MySQL fallback
    'sql',        // Generic SQL
    'tsql',       // T-SQL
    'plsql'       // PL/SQL
  ];

  // Try each dialect
  for (const dialect of dialects) {
    const result = trySqlFormat(sql, dialect, options);
    if (result) {
      return { 
        formatted: result, 
        method: `sql-formatter (${dialect})` 
      };
    }
  }

  // If all dialects fail, return original SQL
  console.warn('All formatting attempts failed. Returning original SQL.');
  return { 
    formatted: sql, 
    method: 'none (fallback to original)' 
  };
}

/**
 * Utility function to output formatted SQL.
 * @param {string} formatted - The formatted SQL
 * @param {string} method - The method used for formatting
 */
export function outputFormattedSql(formatted, method) {
  console.log(formatted);
}

/**
 * Read SQL from file and format it.
 * @param {string} filePath - Path to the SQL file
 */
function processFile(filePath) {
  try {
    console.log(`Reading SQL from: ${filePath}`);
    const rawSql = readFileSync(filePath, 'utf-8');
    
    console.log(`File size: ${rawSql.length} characters\n`);
    
    const { formatted, method } = formatSql(rawSql);
    outputFormattedSql(formatted, method);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ File not found: ${filePath}`);
      console.error('Please check the FILE_LOCATION variable and ensure the file exists.');
    } else {
      console.error('❌ Error processing file:', error.message);
    }
    process.exit(1);
  }
}

// Execute the formatting
processFile(FILE_LOCATION);