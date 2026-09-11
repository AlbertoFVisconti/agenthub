const { app, BrowserWindow, contextBridge, dialog, ipcMain, shell, session } = require('electron')
const path = require('path')
const { fork } = require('child_process')
const spawn = require('cross-spawn')
const treeKill = require('tree-kill')
const fs = require('fs')
const http = require('http')
const crypto = require('crypto')

// Load .env from the monorepo root
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

let apiProcess = null
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Hard security requirements:
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Forward renderer console to main process stdout
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] ${message} (Source: ${sourceId}:${line})`)
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if ((url.startsWith('http://') || url.startsWith('https://')) && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  function loadURLWithRetry(window, url, maxRetries = 30, retryDelay = 1000) {
    let retries = 0;
    const attempt = () => {
      const req = http.get(url, (res) => {
        window.loadURL(url);
      }).on('error', (err) => {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Failed to connect to ${url} after ${maxRetries} attempts.`);
          dialog.showErrorBox('Connection Failed', `Failed to connect to the dev server at ${url}. Make sure Next.js is running.`);
        } else {
          console.log(`Waiting for Next.js server at ${url}... (Attempt ${retries}/${maxRetries})`);
          setTimeout(attempt, retryDelay);
        }
      });
      req.end();
    };
    attempt();
  }

  // In development, load from localhost:3000
  // In production, load the static Next.js files
  if (process.env.NODE_ENV === 'development') {
    loadURLWithRetry(mainWindow, 'http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // Wait for Next.js server to be ready
    loadURLWithRetry(mainWindow, 'http://127.0.0.1:8080')
  }
}

function startApiServer() {
  // Spawn the Fastify API as a background Node process
  // This keeps all Node/Docker execution in the Main context but perfectly isolated from the UI thread.
  if (!app.isPackaged) {
    try {
      const apiDir = path.join(__dirname, '../api')
      const tsxBin = path.join(apiDir, 'node_modules', '.bin', 'tsx')
      const apiSrcPath = path.join(apiDir, 'src/index.ts')
      console.log('Starting API in dev mode with tsx at:', apiSrcPath)
      apiProcess = spawn(tsxBin, ['watch', 'src/index.ts'], {
        cwd: apiDir,
        stdio: 'inherit',
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DEPLOYMENT_MODE: 'desktop',
          API_PORT: '8080'
        }
      })
    } catch (err) {
      console.error('Failed to resolve tsx or start API.', err)
      dialog.showErrorBox('API Startup Failed', `Failed to start local API in dev mode:\n${err.message}`)
    }
  } else {
    const apiPath = path.join(process.resourcesPath, 'api', 'dist', 'index.js')
    console.log('Starting API in production at:', apiPath)
    apiProcess = fork(apiPath, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DEPLOYMENT_MODE: 'desktop',
        API_PORT: '8080'
      }
    })
  }

  if (apiProcess) {
    apiProcess.on('error', (err) => {
      console.error('API Process Error:', err)
      dialog.showErrorBox('API Process Error', `The local API process encountered an error:\n${err.message}`)
    })

    apiProcess.on('exit', (code) => {
      console.log('API Process Exited with code:', code)
      if (code !== 0 && code !== null) {
        dialog.showErrorBox('API Process Crashed', `The local API process exited unexpectedly with code ${code}. Check the terminal logs.`)
      }
    })
  }
}


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

  startApiServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiProcess && apiProcess.pid) {
    try {
      treeKill(apiProcess.pid, 'SIGKILL')
    } catch (err) {
      console.error('Failed to kill API process tree:', err)
    }
  }
})

ipcMain.handle('dialog:pickProjectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('auth:login', async () => {
  const state = crypto.randomBytes(16).toString('hex')
  const remoteApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8081'
  
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`)
      
      if (url.pathname === '/') {
        const receivedState = url.searchParams.get('state')
        const token = url.searchParams.get('token')
        
        if (receivedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Auth Failed</h1><p>State mismatch. Please try again.</p>')
          server.close()
          reject(new Error('State mismatch'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Authentication Successful</h1><p>You can close this tab and return to the app.</p>')
        
        try {
          if (!token) {
            throw new Error('No token provided in callback')
          }
          
          // Set cookie for the UI origin
          const cookie = {
            url: 'http://localhost:3000',
            name: 'device_id',
            value: token,
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
          }
          
          await session.defaultSession.cookies.set(cookie)
          console.log('[AUTH] Cookie set with name:', cookie.name, 'value length:', token.length)
          console.log('[AUTH] Reloading window...')
          if (mainWindow) mainWindow.reload()
          resolve()
        } catch (err) {
          console.error('[AUTH ERROR]', err)
          reject(err)
        } finally {
          server.close()
        }
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const loopbackUrl = `http://127.0.0.1:${port}/`
      const loginUrl = `${remoteApiBase}/auth/github?desktop_callback=${encodeURIComponent(loopbackUrl)}&state=${state}`
      
      console.log(`[AUTH] Listening on ${loopbackUrl}, opening ${loginUrl}`)
      shell.openExternal(loginUrl)

      // Auto-timeout after 5 minutes
      setTimeout(() => {
        if (server.listening) {
          server.close()
          reject(new Error('Authentication timed out'))
        }
      }, 5 * 60 * 1000)
    })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  if (apiProcess) {
    apiProcess.kill()
  }
})


