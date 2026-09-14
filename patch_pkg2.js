const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('packages/tool-utils/package.json', 'utf8'));
pkg.dependencies['@agenthub-tools/tool-sdk'] = 'file:../tool-sdk';
fs.writeFileSync('packages/tool-utils/package.json', JSON.stringify(pkg, null, 2), 'utf8');
