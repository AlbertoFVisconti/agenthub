const fs = require('fs');
let content = fs.readFileSync('electron/main.js', 'utf8');
content = `const fs = require('fs'); fs.writeFileSync('debug.log', 'Started\\n', {flag:'a'});\n` + content;
content = content.replace(/app\.whenReady\(\)\.then\(\(\) => \{/g, `app.whenReady().then(() => {\n  fs.writeFileSync('debug.log', 'Ready\\n', {flag:'a'});`);
content = content.replace(/startApiServer\(\)/g, `fs.writeFileSync('debug.log', 'startApiServer\\n', {flag:'a'});\n  startApiServer()`);
content = content.replace(/createWindow\(\)/g, `fs.writeFileSync('debug.log', 'createWindow\\n', {flag:'a'});\n  createWindow()`);
fs.writeFileSync('electron/main.js', content, 'utf8');
