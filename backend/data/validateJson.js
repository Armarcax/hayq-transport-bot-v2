// validateJson.js
const fs = require('fs');
const path = require('path');

// Կարդալ ֆայլի հասցեն որպես առաջին argument
const filePath = process.argv[2];
if (!filePath) {
  console.error('Օգտագործում: node validateJson.js <c:\Users\Armen\Documents\HAYQWay\hayq-transport-bot\backend\data\routes_small_full_with_eta_updated.json>');
  process.exit(1);
}

// Ստուգել արդյոք ֆայլը գոյություն ունի
if (!fs.existsSync(filePath)) {
  console.error(`❌ Ֆայլ չի գտնվել: ${filePath}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  JSON.parse(content);
  console.log(`✅ Ֆայլը վալիդ JSON է: ${filePath}`);
} catch (err) {
  console.error(`❌ Ֆայլը վալիդ JSON չէ: ${filePath}`);
  console.error('Սխալ:', err.message);
}
