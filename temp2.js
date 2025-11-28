// import { format } from "sql-formatter";
// import { readFileSync } from "fs";
// import { resolve } from "path";

// ============================================
// CONFIGURATION: Set your SQL file path here
// ============================================
const FILE_LOCATION = "module2_files/input_files/CBT_NEURO_MIGRAINE_CALL_ACTIVITY_ITMD.sql";  // <-- Change this to your file path
import { format } from "sql-formatter";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ============================================
// CONFIGURATION
// ============================================
// const FILE_LOCATION = "module2_files/input_files/CBT_NEURO_MIGRAINE_CALL_ACTIVITY_ITMD.sql";

// Priority order for Data Engineering (Spark/Snowflake/Hive are most common)
const TARGET_DIALECTS = ['spark', 'snowflake', 'postgresql', 'redshift', 'bigquery']; 

/**
 * 1. MASKING STRATEGY
 * Hides template variables ({{ x }}, ${ x }, etc) so the formatter treats them as identifiers
 * instead of throwing syntax errors.
 */
function maskTemplates(sql) {
    const masks = [];
    let maskedSql = sql;

    // Regex for Jinja {{...}} and {%...%}
    maskedSql = maskedSql.replace(/({{|{%)([\s\S]*?)(}}|%})/g, (match) => {
        const placeholder = `__TEMPLATE_BLOCK_${masks.length}__`;
        masks.push({ placeholder, original: match });
        return placeholder;
    });

    // Regex for Hive/Spark variables ${...}
    maskedSql = maskedSql.replace(/(\${)([\s\S]*?)(})/g, (match) => {
        const placeholder = `__VAR_BLOCK_${masks.length}__`;
        masks.push({ placeholder, original: match });
        return placeholder;
    });

    return { maskedSql, masks };
}

/**
 * Unmasks the placeholders back to original variables
 */
function unmaskTemplates(formattedSql, masks) {
    let result = formattedSql;
    // Replace in reverse order to handle nesting if any
    for (let i = masks.length - 1; i >= 0; i--) {
        // We use a global replace because the formatter might have moved the token
        // or changed whitespace around it.
        result = result.split(masks[i].placeholder).join(masks[i].original);
    }
    return result;
}

/**
 * 2. HEURISTIC STRATEGY (The "Poor Man's Formatter")
 * If the strict parser fails (syntax error), use Regex to force readability.
 * This guarantees we never return a blob of text.
 */
function heuristicFormat(sql) {
    console.log("   ⚠️  Parser failed. Applying Heuristic (Regex) formatting...");
    let res = sql
        // Add newline before main keywords
        .replace(/\s+(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|GROUP BY|ORDER BY|HAVING|WITH|UNION|CASE|WHEN|AND|OR)/gi, "\n$1")
        // Fix multiple newlines
        .replace(/\n{3,}/g, "\n\n")
        // Basic indentation for joins (visual only)
        .replace(/\n(LEFT|RIGHT|INNER|OUTER) JOIN/gi, "\n  $1 JOIN")
        .replace(/\nAND/gi, "\n  AND")
        .replace(/\nOR/gi, "\n  OR");
        
    return res;
}

/**
 * 3. CORE FORMATTER
 * Tries to format a single statement.
 */
function formatSingleStatement(statement, dialects) {
    const cleanStmt = statement.trim();
    if (!cleanStmt) return "";

    // Step A: Mask Templates
    const { maskedSql, masks } = maskTemplates(cleanStmt);

    // Step B: Try priority dialects
    for (const dialect of dialects) {
        try {
            const formatted = format(maskedSql, {
                language: dialect,
                tabWidth: 4,               // Standard for data
                keywordCase: "upper",
                linesBetweenQueries: 2,
                indentStyle: "standard",
                logicalOperatorNewline: "before",
                // Allow params allows some basic variables to pass through
                paramTypes: { custom: [{ regex: String.raw`\$\{[a-zA-Z0-9_]+\}` }] } 
            });

            // Step C: Unmask and return
            return unmaskTemplates(formatted, masks);
        } catch (e) {
            // Continue to next dialect
        }
    }

    // Step D: Parsing failed for all dialects -> Use Heuristic
    return heuristicFormat(cleanStmt);
}

/**
 * 4. SAFE SPLITTER
 * Splits SQL by semicolon, but ignores semicolons inside quotes.
 */
function splitSqlSafely(sql) {
    // This regex matches a semicolon that is NOT followed by an odd number of quotes
    // Note: This is a simplified safe-split. For extremely complex cases, a lexer is needed.
    // However, for 99% of SQL files, splitting by ";\n" (semicolon + newline) is safer.
    
    // Simplest robust approach: 
    // If the file looks like a script, try to format the WHOLE thing first. 
    // If that fails, split by generic delimiter.
    return sql.split(/;\s*\n/); 
}

/**
 * Main Process
 */
function processFile(filePath) {
    try {
        const fullPath = resolve(filePath);
        console.log(`📂 Reading: ${fullPath}`);
        
        const content = readFileSync(fullPath, 'utf-8');
        if (!content.trim()) return;

        // Try to format the whole file first as Spark (most permissive usually)
        // If the file is a single giant query, this is best.
        try {
            console.log("🔄 Attempting full-file format...");
            const { maskedSql, masks } = maskTemplates(content);
            const fullFormat = format(maskedSql, { language: 'spark', tabWidth: 4, keywordCase: "upper" });
            const final = unmaskTemplates(fullFormat, masks);
            
            outputResult(final, "Full-File Parse (Spark)");
            return;
        } catch (e) {
            console.log("   (Full file parse failed, switching to statement-by-statement processing)");
        }

        // If full file fails, split and conquer
        const statements = splitSqlSafely(content);
        const results = [];

        statements.forEach((stmt, index) => {
            // Only process if it has content
            if (stmt.trim().length > 0) {
                const formatted = formatSingleStatement(stmt, TARGET_DIALECTS);
                results.push(formatted);
            }
        });

        // Join back with semicolons
        const finalOutput = results.join(';\n\n');
        outputResult(finalOutput, "Statement-by-Statement (Hybrid)");

    } catch (error) {
        console.error("❌ Fatal Error:", error.message);
    }
}

function outputResult(formattedSql, method) {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Success via: ${method}`);
    console.log('='.repeat(50));
    console.log(formattedSql); // Or write to file here
    console.log('='.repeat(50));
}

// Execute
processFile(FILE_LOCATION);