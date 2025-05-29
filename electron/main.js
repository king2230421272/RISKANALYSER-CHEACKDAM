const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  // 加载前端打包后的 index.html
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

function startBackend() {
  // 启动 FastAPI 后端（假设已用 pyinstaller 打包为 main.exe，或用 python main.py）
  const backendPath = path.join(__dirname, '../../backend/main.exe');
  backendProcess = spawn(backendPath, [], {
    cwd: path.join(__dirname, '../../backend'),
    shell: true,
    detached: false
  });
  backendProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI ERROR] ${data}`);
  });
  backendProcess.on('close', (code) => {
    console.log(`FastAPI 进程退出，退出码 ${code}`);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});