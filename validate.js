const fs = require('fs');
const path = require('path');

const dataFolder = path.join(__dirname, 'backend', 'data'); // <-- մեր պանակը
const files = fs.readdirSync(dataFolder).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(dataFolder, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ ${file} վալիդ է`);
  } catch (err) {
    console.error(`❌ ${file} սխալ ունի JSON-ում:\n`, err.message);
  }
});
