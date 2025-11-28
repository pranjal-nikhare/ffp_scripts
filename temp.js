import { format } from "sql-formatter";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================
// CONFIGURATION: Set your SQL file path here
// ============================================
// const FILE_LOCATION = "module2_files/input_files/CBT_NEURO_MIGRAINE_IC_UNIVERSE_ITMD.sql";  // <-- Change this to your file path
const FILE_LOCATION = "module2_files/input_files/CBT_NEURO_MIGRAINE_CALL_ACTIVITY_ITMD.sql"; 

/**
 * Attempt to format SQL with a specific dialect
 * @param {string} sql 
 * @param {string} language 
 * @param {object} options 
 * @returns {string|null} 
 */
function trySqlFormat(sql, language, options = {}) {
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
    
    const formatted = format(sql, defaultOptions);
    
    // Validate that formatting actually worked
    if (formatted && formatted.length > 0) {
      return formatted;
    }
    return null;
    
  } catch (error) {
    // Silently fail and return null - we'll try other dialects
    return null;
  }
}

/**
 * Basic SQL cleanup when all formatters fail
 * @param {string} sql 
 * @returns {string}
 */
function basicSqlCleanup(sql) {
  try {
    return sql
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/,\s*/g, ',\n  ')  // Add newlines after commas
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT\s+JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bINNER\s+JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bGROUP\s+BY\b/gi, '\nGROUP BY')
      .replace(/\bORDER\s+BY\b/gi, '\nORDER BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .trim();
  } catch (error) {
    return sql;  // Return original if cleanup fails
  }
}

/**
 * Main formatting function with multiple fallback strategies
 * @param {string} sql - The SQL string to format
 * @param {object} options - Formatting options
 * @returns {{formatted: string, method: string, success: boolean}} 
 */
function formatSql(sql, options = {}) {
  // Validate input
  if (!sql || typeof sql !== 'string') {
    return { 
      formatted: sql || '', 
      method: 'none (invalid input)',
      success: false
    };
  }

  // Trim whitespace
  sql = sql.trim();
  
  if (sql.length === 0) {
    return {
      formatted: '',
      method: 'none (empty input)',
      success: false
    };
  }

  // List of SQL dialects to try in order
  const dialects = [
    'snowflake',
    'postgresql',
    'mysql',
    'sqlite',
    'mariadb',
    'bigquery',
    'redshift',
    'spark',
    'sql',
    'tsql',
    'plsql',
    'db2',
    'hive',
    'n1ql'
  ];

  // Try each dialect
  for (const dialect of dialects) {
    const result = trySqlFormat(sql, dialect, options);
    if (result) {
      return { 
        formatted: result, 
        method: `sql-formatter (${dialect})`,
        success: true
      };
    }
  }

  // If all formatters fail, apply basic cleanup
  console.warn('⚠️  All sql-formatter dialects failed. Applying basic formatting...');
  const basicFormatted = basicSqlCleanup(sql);
  
  return { 
    formatted: basicFormatted, 
    method: 'basic cleanup (fallback)',
    success: false
  };
}

/**
 * Output formatted SQL
 * @param {string} formatted - The formatted SQL
 * @param {string} method - The method used for formatting
 * @param {boolean} success - Whether formatting succeeded
 */
function outputFormattedSql(formatted, method, success) {
  console.log('\n' + '='.repeat(80));
  console.log(`Formatting Method: ${method}`);
  console.log(`Status: ${success ? '✅ Success' : '⚠️  Fallback Used'}`);
  console.log('='.repeat(80) + '\n');
  console.log(formatted);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Validate file path
 * @param {string} filePath 
 * @returns {{valid: boolean, resolvedPath: string, error: string|null}}
 */
function validateFilePath(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        resolvedPath: '',
        error: 'File path is empty or invalid'
      };
    }

    const resolvedPath = resolve(filePath);
    
    return {
      valid: true,
      resolvedPath,
      error: null
    };
  } catch (error) {
    return {
      valid: false,
      resolvedPath: '',
      error: error.message
    };
  }
}

/**
 * Read and validate SQL file content
 * @param {string} filePath 
 * @returns {{content: string|null, error: string|null}}
 */
function readSqlFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    if (!content || content.trim().length === 0) {
      return {
        content: null,
        error: 'File is empty'
      };
    }

    return {
      content: content,
      error: null
    };
  } catch (error) {
    let errorMessage = 'Unknown error reading file';
    
    if (error.code === 'ENOENT') {
      errorMessage = `File not found: ${filePath}`;
    } else if (error.code === 'EACCES') {
      errorMessage = `Permission denied: ${filePath}`;
    } else if (error.code === 'EISDIR') {
      errorMessage = `Path is a directory, not a file: ${filePath}`;
    } else {
      errorMessage = `Error reading file: ${error.message}`;
    }

    return {
      content: null,
      error: errorMessage
    };
  }
}

/**
 * Main processing function
 * @param {string} filePath - Path to the SQL file
 */
export async function processFile(filePath) {
  console.log("\n🔄 Starting SQL formatter...\n");

  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid) {
    return { error: pathValidation.error };
  }

  const fileRead = readSqlFile(pathValidation.resolvedPath);
  if (fileRead.error) {
    return { error: fileRead.error };
  }

  const rawSql = fileRead.content;

  let result;
  try {
    result = formatSql(rawSql);
  } catch (error) {
    console.error("❌ Unexpected formatting error:", error.message);
    return { formatted: rawSql, method: "fallback", success: false };
  }

  return {
    formatted: result.formatted,
    method: result.method,
    success: true
  };
}


// Execute with proper error handling
// try {
//   processFile(FILE_LOCATION);
// } catch (error) {
//   console.error('\n❌ Fatal error:', error.message);
//   console.error('\nStack trace:');
//   console.error(error.stack);
//   process.exit(1);
// }