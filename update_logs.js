const fs = require('fs');
let content = fs.readFileSync('electron/main.js', 'utf8');
content = content.replace(/'debug\.log'/g, "'C:\\\\Users\\\\alber\\\\Desktop\\\\debug.log'");
fs.writeFileSync('electron/main.js', content, 'utf8');
