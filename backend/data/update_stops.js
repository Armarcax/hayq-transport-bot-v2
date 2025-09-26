const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "routes_small.json");

function fixJsonString(str) {
  return str
    .replace(/\t/g, "")          // ջնջում ենք \t
    .replace(/\r?\n/g, "")       // newline-ները հանում ենք
    .replace(/}\s*{/g, "}, {")   // եթե 2 օբյեկտ կպել են իրար
    .replace(/]\s*\[/g, "], [")  // եթե 2 array կպել են իրար
    .replace(/,\s*}/g, "}")      // ավելորդ , փակ } առաջ
    .replace(/,\s*]/g, "]");     // ավելորդ , փակ ] առաջ
}

try {
  let rawData = fs.readFileSync(filePath, "utf8");

  // մաքրել JSON-ը
  rawData = fixJsonString(rawData);

  let stopsData = JSON.parse(rawData); // փորձենք parse անել

  // թարմացնենք կանգառները
  stopsData = stopsData.map((stop) => {
    if (!stop.coords) stop.coords = null;
    if (!stop.time) stop.time = null;
    return stop;
  });

  fs.writeFileSync(filePath, JSON.stringify(stopsData, null, 2), "utf8");
  console.log("✅ JSON հաջողությամբ մաքրվեց ու թարմացվեց!");
} catch (err) {
  console.error("❌ Սխալ JSON:", err.message);
}
