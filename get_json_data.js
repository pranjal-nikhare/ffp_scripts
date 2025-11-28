import { readFile } from 'fs/promises';

// Helper to get nested values using "a.b.c" paths
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => {
    // if key is a number (array index), convert it
    const k = isNaN(key) ? key : Number(key);
    return acc?.[k];
  }, obj);
}

export async function get_calculation_attributes_count(filePath) {
  try {
    const data = await readFile(filePath, "utf8");
    const json = JSON.parse(data);

    const attrs = json.calculation_attributes;

    // If it's an array → return length
    if (Array.isArray(attrs)) {
      return attrs.length;
    }

    // If it's an object → return number of keys
    if (typeof attrs === "object" && attrs !== null) {
      return Object.keys(attrs).length;
    }

    return 0;
  } catch (err) {
    console.error("Error reading JSON file:", err.message);
    return 0;
  }
}

export async function readJsonAttributes(filePath, fields = []) {
  try {
    const data = await readFile(filePath, 'utf8');
    const json = JSON.parse(data);

    const result = {};

    for (const path of fields) {
      const value = getNestedValue(json, path);
      result[path] = value;
    }

    return result;

  } catch (err) {
    console.error("Error reading JSON file:", err.message);
    return null;
  }
}

export async function get_query(filePath, num) {
  const data = await readJsonAttributes(filePath, [
    `calculation_attributes.${num}.value.query`
  ]);
  return data;
}

export async function get_file_name(filePath, num) {
  const data2 = await readJsonAttributes(filePath, [
    `calculation_attributes.${num}.attribute`
  ]);
  return data2;
}

// const loc = 'module2_files/input_files/CBT_NEURO_MIGRAINE.json';

// const loc = '/home/user/express-serv/module2_files/input_files/7119b57c12a2/CBT_NEURO_MIGRAINE.json'

// const count = await get_calculation_attributes_count(loc);
// console.log("numbers = = " + count)

// const querry = await get_file_name(loc, 3)
// console.log(querry)

// const file_name = data2["calculation_attributes.1.attribute"];
// const query = data["calculation_attributes.1.value.query"];


// console.log(file_name);
// console.log(query);

// console.log(data)
// console.log(data2["calculation_attributes.1.attribute"])  

// console.log(data["calculation_attributes.1.value.query"]);


