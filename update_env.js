const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('electron/package.json', 'utf8'));
pkg.build.extraResources.push({
  "from": "../.env",
  "to": ".env"
});
fs.writeFileSync('electron/package.json', JSON.stringify(pkg, null, 2), 'utf8');
