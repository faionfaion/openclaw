const fs = require("fs");
const files = [
  "en.json",
  "uk.json",
  "de.json",
  "es.json",
  "fr.json",
  "pt.json",
  "ja.json",
  "zh.json",
  "pl.json",
  "tr.json",
];

for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
    console.log();
  } catch {
    console.log();
  }
}
