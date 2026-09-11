const fs = require('fs');
let content = fs.readFileSync('electron/main.js', 'utf8');

const checkCode = `
const { execSync } = require('child_process');

function checkDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

app.whenReady().then(() => {
  if (!checkDockerInstalled()) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Docker Required',
      message: 'AgentHub requires Docker Desktop to run sandboxed tools safely. Please install Docker Desktop and restart the app.',
      buttons: ['Download Docker', 'Exit']
    }).then(({ response }) => {
      if (response === 0) {
        shell.openExternal('https://www.docker.com/products/docker-desktop/');
      }
      app.quit();
    });
    return;
  }
`;

content = content.replace('app.whenReady().then(() => {', checkCode);
content = content.replace("const spawn = require('cross-spawn')", "let spawn; if (!app.isPackaged) spawn = require('cross-spawn');");

fs.writeFileSync('electron/main.js', content, 'utf8');
