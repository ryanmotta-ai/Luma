/**
 * desktop/main.js — casca desktop do Luma (Electron)
 *
 * DECISÃO CENTRAL: a janela carrega a URL de produção (GitHub Pages), NÃO uma
 * cópia local dos arquivos. Assim o .exe nunca envelhece: cada deploy atualiza
 * todos os franqueados na hora, como no navegador — sem auto-updater, sem
 * versão presa na máquina de ninguém. A casca é burra de propósito.
 * O app real continua 100% em /js e /css — nada do Luma vive aqui.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_URL = 'https://ryanmotta-ai.github.io/Luma/';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#FAFAFA', // off-white da marca: evita flash branco no boot
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadURL(APP_URL);

  // Sem internet (o Luma precisa dela pro Supabase de qualquer forma):
  // mostra a tela de erro local em vez do erro cru do Chromium.
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame) win.loadFile(path.join(__dirname, 'error.html'));
  });

  // Link externo (Instagram, ajuda, etc.) abre no navegador do sistema,
  // nunca numa segunda janela da casca.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Menu nulo mata os atalhos padrão — devolve o recarregar (F5 / Ctrl+R).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' &&
        (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))) {
      win.loadURL(APP_URL);
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
