const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('electron/build_stage/api/package.json', 'utf8'));
pkg.dependencies['@agenthub-tools/tool-sdk'] = 'file:../../../../packages/tool-sdk';
pkg.dependencies['@agenthub-tools/tool-utils'] = 'file:../../../../packages/tool-utils';
fs.writeFileSync('electron/build_stage/api/package.json', JSON.stringify(pkg, null, 2), 'utf8');
