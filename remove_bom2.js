const fs = require('fs');
let file = 'electron/main.js';
let content = fs.readFileSync(file);
if (content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
  console.log('Found BOM in:', file);
  fs.writeFileSync(file, content.slice(3));
}
