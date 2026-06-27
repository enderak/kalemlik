const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'organisms', 'CastlePencilCase.jsx');
let content = fs.readFileSync(file, 'utf8');
// Check for dollar signs and backticks
const hasDollar = content.includes('$');
const hasBacktick = content.includes('`');
console.log('Has $:', hasDollar);
console.log('Has backtick:', hasBacktick);
console.log('First 300 chars:', content.substring(0, 300));
