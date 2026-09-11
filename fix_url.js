const fs = require('fs');
let content = fs.readFileSync('electron/main.js', 'utf8');
content = content.replace(/\} else \{\s*\/\/\s*Wait for Next\.js server to be ready\s*loadURLWithRetry\(mainWindow, 'http:\/\/localhost:3000'\)/g, "} else {\n    // Wait for Next.js server to be ready\n    loadURLWithRetry(mainWindow, 'http://127.0.0.1:8080')");
fs.writeFileSync('electron/main.js', content, 'utf8');
