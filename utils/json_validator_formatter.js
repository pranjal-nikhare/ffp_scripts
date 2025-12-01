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

      if (!item.value || typeof item.value !== "object") {
        return { valid: false, error: `Missing 'value' object at index ${i}.` };
      }

      if (!("query" in item.value)) {
        return { valid: false, error: `Missing 'value.query' at index ${i}.` };
      }
    }

    return { valid: true };

  } catch (err) {
    return { valid: false, error: "Invalid JSON: " + err.message };
  }
}
