// Remove prefix before first double underscore: a__b -> b
// export function removeDoubleUnderscorePrefix(str) {
//   if (!str || typeof str !== "string") return str;

//   // If no "__" exists, return original
//   if (!str.includes("__")) return str;

//   // Split only at the FIRST occurrence of "__"
//   return str.split(/__(.+)/)[1];
// }


// export function removeDoubleUnderscorePrefix(text) {
//     if (!text || typeof text !== "string") return text;
  
//     return text.replace(/\b[^_\s]+__([^_\s]+)/g, "$1");
//   }

//   export function removeDoubleUnderscorePrefix(text) {
//     if (!text || typeof text !== "string") return text;
  
//     return text.replace(/(?:^|\s)([^_\s]+)__([^\s]+)/g, (match, before, after) => {
//       const space = match.startsWith(" ") ? " " : "";
//       return space + after;
//     });
//   }
  
export function removeDoubleUnderscorePrefix(text) {
    if (!text || typeof text !== "string") return text;
  
    // Replace ANYTHING__SOMETHING with SOMETHING
    return text.replace(/([A-Za-z0-9_]+)__([A-Za-z0-9_]+)/g, "$2");
  }
  

const text = "SELECT DISTINCT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM ( SELECT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM CBT_IMMUN_DERM__CBT_IMMUN_DERM_SALES_ITMD UNION ALL SELECT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM CBT_IMMUN_DERM__CBT_IMMUN_DERM_CALL_ACTIVITY_ITMD UNION ALL SELECT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM CBT_IMMUN_DERM__CBT_IMMUN_DERM_IREP_EMAILS_ITMD UNION ALL SELECT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM CBT_IMMUN_DERM__CBT_IMMUN_DERM_CALL_SAMPLES_ITMD UNION ALL SELECT ABV_CUSTOMER_ID, WEEK_DATE, INDICATION_CODE, BRAND_NAME FROM CBT_IMMUN_DERM__CBT_IMMUN_DERM_PHYSICIAN_SAMPLES_ITMD)";

// const text = "CBT_IMMUN_DERM__CBT_IMMUN_DERM_IREP_EMAILS_ITMD";
const formatted = removeDoubleUnderscorePrefix(text);
console.log(formatted)
