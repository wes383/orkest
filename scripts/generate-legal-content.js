const fs = require('fs');
const path = require('path');

const LEGAL_DIR = path.join(__dirname, '..', 'public', 'legal');
const OUTPUT_DIR = path.join(__dirname, '..', 'lib', 'legal');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'content.json');

function generateLegalContent() {
  console.log('Generating legal content static JSON file...');

  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`Error: Legal directory not found at ${LEGAL_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(LEGAL_DIR).filter(file => file.endsWith('.md'));
  
  const contentMap = {};

  for (const file of files) {
    const filePath = path.join(LEGAL_DIR, file);
    console.log(`Reading ${file}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    contentMap[file] = content;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(contentMap, null, 2), 'utf-8');
  console.log(`Successfully generated static legal content at ${OUTPUT_FILE}`);
}

generateLegalContent();
