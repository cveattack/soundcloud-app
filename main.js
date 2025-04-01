const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const api = require('./api');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    title: 'SoundCloud Player',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  mainWindow.loadFile('src/index.html');
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-tracks', () => api.scanTracks());
  
  ipcMain.handle('import-tracks', async () => {
    const result = await dialog.showOpenDialog({ 
      properties: ['openDirectory'],
      title: 'Select folder with tracks'
    });
    if (!result.canceled) return api.scanTracks();
    return [];
  });
  
  ipcMain.handle('save-liked-tracks', (_, likedTracks) => api.saveLikedTracks(likedTracks));
  
  ipcMain.handle('get-liked-tracks', () => api.getLikedTracks());
  
  ipcMain.handle('create-playlist', (_, name) => api.createPlaylist(name));
  
  ipcMain.handle('get-playlists', () => api.getPlaylists());
  
  ipcMain.handle('add-to-playlist', (_, playlistId, trackId) => 
    api.addToPlaylist(playlistId, trackId));
  
  ipcMain.handle('remove-track', (_, trackId) => api.removeTrack(trackId));
  
  ipcMain.handle('get-soundcloud-tracks', () => api.getSoundCloudTracks());
  
  ipcMain.handle('search-soundcloud', (_, query) => api.searchSoundCloud(query));
  
  ipcMain.handle('get-soundcloud-stream', (_, trackId) => api.getSoundCloudStream(trackId));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});