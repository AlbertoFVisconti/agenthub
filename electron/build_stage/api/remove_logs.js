const fs = require('fs');

function removeLogs(file, patterns) {
  let text = fs.readFileSync(file, 'utf8');
  for (const p of patterns) {
    if (typeof p === 'string') {
      text = text.replace(p, '');
    } else {
      text = text.replace(p, '');
    }
  }
  fs.writeFileSync(file, text, 'utf8');
}

removeLogs('api/src/index.ts', [
  /console\.log\('GITHUB_CLIENT_ID is set:.*?\n/g,
  /.*console\.log\(`\[NETWORK TAB\].*?\n/g,
  /.*console\.log\(`\[DEBUG\] Resolving static root.*?\n/g
]);

removeLogs('api/src/plugins/session.ts', [
  /req\.log\.info\([^)]+'\[TRACE\] Checking cookies.*?\n/g
]);

removeLogs('api/src/lib/models/anthropic.ts', [
  /.*console\.log\(`\[Anthropic\] message_delta.*?\n/g
]);

removeLogs('api/src/lib/models/openai.ts', [
  /.*console\.log\(`\[OpenAI Adapter\] Sending request.*?\n/g,
  /.*console\.log\(`\[OpenAI\] chunk finish_reason.*?\n/g
]);

let modelsPath = 'api/src/routes/models.ts';
let modelsTxt = fs.readFileSync(modelsPath, 'utf8');
modelsTxt = modelsTxt.replace(/req\.log\.info\(([^,]+),\s*'\[TRACE\]/g, "req.log.debug($1, '[TRACE]");
fs.writeFileSync(modelsPath, modelsTxt, 'utf8');

let mcpPath = 'api/src/lib/agent/executors/mcp-stdio.ts';
let mcpTxt = fs.readFileSync(mcpPath, 'utf8');
mcpTxt = mcpTxt.replace(/console\.log/g, 'console.debug');
fs.writeFileSync(mcpPath, mcpTxt, 'utf8');
