// validate_json.js
import { readFile } from "fs/promises";

export async function validateJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const json = JSON.parse(raw);

    if (!json || typeof json !== "object") {
      return { valid: false, error: "JSON root must be an object." };
    }

    const attrs = json.calculation_attributes;

    if (!attrs) {
      return { valid: false, error: "`calculation_attributes` is missing." };
    }

    if (!(Array.isArray(attrs) || typeof attrs === "object")) {
      return { valid: false, error: "`calculation_attributes` must be array or object." };
    }

    const list = Array.isArray(attrs) ? attrs : Object.values(attrs);

    for (let i = 0; i < list.length; i++) {
      const item = list[i];

      if (!item || typeof item !== "object") {
        return { valid: false, error: `Item ${i} must be an object.` };
      }

      if (!("attribute" in item)) {
        return { valid: false, error: `Missing 'attribute' at index ${i}.` };
      }

      if (!("value" in item)) {
        return { valid: false, error: `Missing 'value' at index ${i}.` };
      }

      // NEW: Handle both string and object values
      if (typeof item.value === "object" && item.value !== null) {
        // If value is an object, check for query property
        if (!("query" in item.value)) {
          return { valid: false, error: `Missing 'value.query' at index ${i}.` };
        }
      } else if (typeof item.value !== "string") {
        // If value is not an object, it should be a string
        return { valid: false, error: `'value' at index ${i} must be either a string or an object with 'query'.` };
      }
    }

    return { valid: true };

  } catch (err) {
    return { valid: false, error: "Invalid JSON: " + err.message };
  }
}