const concurrently = require('concurrently').default || require('concurrently').concurrently || require('concurrently');
const treeKill = require('tree-kill');

const { result, commands } = concurrently(
  [
    { command: 'pnpm --filter web dev', name: 'web', prefixColor: 'blue' },
    { command: 'pnpm --filter api dev', name: 'api', prefixColor: 'yellow' },
    { command: 'pnpm --filter @agenthub/desktop start', name: 'desktop', prefixColor: 'green' }
  ],
  {
    prefix: 'name',
    killOthers: false, // We handle killing manually
    restartTries: 0,
  }
);

let isShuttingDown = false;

function killTree(pid, name) {
  return new Promise((resolve) => {
    console.log(`[agenthub] Initiating kill for ${name} (PID: ${pid})`);
    treeKill(pid, 'SIGKILL', (err) => {
      if (err) console.error(`[agenthub] Failed to kill ${name} (PID: ${pid}):`, err);
      else console.log(`[agenthub] Confirmed kill for ${name} (PID: ${pid})`);
      resolve();
    });
  });
}

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n[agenthub] Shutting down all processes...');
  
  const killPromises = [];
  commands.forEach(cmd => {
    if (cmd.pid) {
      killPromises.push(killTree(cmd.pid, cmd.name));
    }
  });
  
  // Safety net in case treeKill genuinely hangs
  const timeoutId = setTimeout(() => {
    console.error('[agenthub] Cleanup timed out after 5 seconds, forcing exit.');
    process.exit(1);
  }, 5000);
  
  await Promise.all(killPromises);
  clearTimeout(timeoutId);

  // Verification step using Node's net module
  console.log('[agenthub] Verifying ports 3000 and 8081 are free...');
  const net = require('net');
  
  function checkPort(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', (e) => {
        console.error(`[agenthub] WARNING: Port ${port} is still in use! (${e.code})`);
        resolve(false);
      });
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
  }

  const p3000 = await checkPort(3000);
  const p8081 = await checkPort(8081);

  if (p3000 && p8081) {
    console.log('[agenthub] Cleanup fully verified. No orphaned processes on required ports.');
  } else {
    console.error('[agenthub] Cleanup verification failed. Orphans may remain.');
  }

  process.exit(0);
}

commands.forEach(cmd => {
  cmd.close.subscribe((event) => {
    console.log(`\n[agenthub] Command ${cmd.name} exited with code ${event.exitCode || (event[0] && event[0].exitCode)}`);
    cleanup();
  });
});

result.catch(() => {}); // Prevent unhandled rejection warning when commands exit with non-zero

if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
