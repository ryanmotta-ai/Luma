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

  // No Windows a barra de menu é ruído → some. No MAC, NÃO: o menu padrão do
  // macOS carrega os atalhos essenciais (Cmd+C/V/X/A e Cmd+Q); zerá-lo quebraria
  // copiar/colar no chat e o Cmd+Q. Então só removemos o menu fora do Mac.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
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

  // Recarregar: F5 (Windows) e Ctrl+R / Cmd+R (Cmd no Mac vem em input.meta).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' &&
        (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))) {
      win.loadURL(APP_URL);
    }
  });
}

app.whenReady().then(createWindow);

// Convenção do macOS: fechar a janela NÃO encerra o app (ele fica no Dock);
// só sai no Cmd+Q. No Windows/Linux, fechar a última janela encerra.
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// Clicar no ícone do Dock com o app aberto e sem janelas reabre a janela.
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
