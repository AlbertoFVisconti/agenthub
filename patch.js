const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('electron/build_stage/api/package.json', 'utf8'));
pkg.dependencies['@agenthub-tools/types'] = 'file:../../../packages/types/agenthub-types-0.0.1.tgz';
pkg.dependencies['@agenthub-tools/tool-sdk'] = 'file:../../../packages/tool-sdk/agenthub-tool-sdk-1.0.0.tgz';
pkg.dependencies['@agenthub-tools/tool-utils'] = 'file:../../../packages/tool-utils/agenthub-tool-utils-1.0.0.tgz';
fs.writeFileSync('electron/build_stage/api/package.json', JSON.stringify(pkg, null, 2), 'utf8');
