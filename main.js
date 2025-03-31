const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

let mainWindow;
Menu.setApplicationMenu(null);

const SOUNDCLOUD_CONFIG = {
  CLIENT_ID: 'put ur client_id here',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const userDataPath = app.getPath('userData');
const likedTracksPath = path.join(userDataPath, 'likedTracks.json');
const playlistsPath = path.join(userDataPath, 'playlists.json');

function getFileUrl(filePath) {
  if (!filePath) return null;
  return path.resolve(__dirname, filePath).replace(/\\/g, '/');
}

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
}

function scanTracks() {
  const tracksDir = path.join(__dirname, 'tracks');
  if (!fs.existsSync(tracksDir)) fs.mkdirSync(tracksDir);

  const folders = fs.readdirSync(tracksDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  return folders.map(folder => {
    const folderPath = path.join(tracksDir, folder);
    const files = fs.readdirSync(folderPath);
    
    const mp3File = files.find(f => f.endsWith('.mp3'));
    const coverFile = files.find(f => ['picture.jpg', 'cover.jpg'].includes(f.toLowerCase()));
    
    if (!mp3File) return null;
    
    const [artist, ...titleParts] = mp3File.replace('.mp3', '').split(' - ');
    
    return {
      id: folder,
      path: getFileUrl(path.join('tracks', folder, mp3File)),
      cover: coverFile ? getFileUrl(path.join('tracks', folder, coverFile)) : null,
      artist: artist || 'Unknown Artist',
      title: titleParts.join(' - ') || 'Unknown Track'
    };
  }).filter(Boolean);
}

function saveLikedTracks(likedTracks) {
  fs.writeFileSync(likedTracksPath, JSON.stringify(likedTracks));
}

function getLikedTracks() {
  try {
    if (fs.existsSync(likedTracksPath)) {
      return JSON.parse(fs.readFileSync(likedTracksPath));
    }
  } catch (e) {
    console.error('Error reading liked tracks:', e);
  }
  return [];
}

function createPlaylist(name) {
  let playlists = [];
  try {
    if (fs.existsSync(playlistsPath)) {
      playlists = JSON.parse(fs.readFileSync(playlistsPath));
    }
  } catch (e) {
    console.error('Error reading playlists:', e);
  }

  const newPlaylist = {
    id: Date.now().toString(),
    name,
    tracks: []
  };

  playlists.push(newPlaylist);
  fs.writeFileSync(playlistsPath, JSON.stringify(playlists));
  return newPlaylist;
}

function getPlaylists() {
  try {
    if (fs.existsSync(playlistsPath)) {
      return JSON.parse(fs.readFileSync(playlistsPath));
    }
  } catch (e) {
    console.error('Error reading playlists:', e);
  }
  return [];
}

function addToPlaylist(playlistId, trackId) {
  let playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist && !playlist.tracks.includes(trackId)) {
    playlist.tracks.push(trackId);
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists));
  }
}

function removeTrack(trackId) {
  const tracksDir = path.join(__dirname, 'tracks', trackId);
  if (fs.existsSync(tracksDir)) {
    fs.rmSync(tracksDir, { recursive: true });
    return true;
  }
  return false;
}

async function getSoundCloudStream(trackId) {
  try {
    const response = await axios.get(`https://api-v2.soundcloud.com/tracks/${trackId}/stream`, {
      params: {
        client_id: SOUNDCLOUD_CONFIG.CLIENT_ID
      },
      headers: {
        'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT
      }
    });
    return response.data.url;
  } catch (error) {
    console.error('Error getting stream URL:', error);
    return null;
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-tracks', () => scanTracks());
  ipcMain.handle('import-tracks', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!result.canceled) return scanTracks();
    return [];
  });
  ipcMain.handle('save-liked-tracks', (event, likedTracks) => saveLikedTracks(likedTracks));
  ipcMain.handle('get-liked-tracks', () => getLikedTracks());
  ipcMain.handle('create-playlist', (event, name) => createPlaylist(name));
  ipcMain.handle('get-playlists', () => getPlaylists());
  ipcMain.handle('add-to-playlist', (event, playlistId, trackId) => addToPlaylist(playlistId, trackId));
  ipcMain.handle('remove-track', (event, trackId) => removeTrack(trackId));
  
  ipcMain.handle('get-soundcloud-tracks', async () => {
    try {
      const response = await axios.get('https://api-v2.soundcloud.com/charts', {
        params: {
          kind: 'top',
          genre: 'soundcloud:genres:all-music',
          client_id: SOUNDCLOUD_CONFIG.CLIENT_ID,
          limit: 25
        },
        headers: {
          'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT
        }
      });

      return response.data.collection.map(item => ({
        id: item.track.id.toString(),
        title: item.track.title,
        artist: item.track.user.username || 'Unknown Artist',
        cover: item.track.artwork_url ? item.track.artwork_url.replace('large', 't500x500') : null,
        duration: item.track.duration,
        streamUrl: item.track.permalink_url,
        isSoundCloud: true
      }));
    } catch (error) {
      console.error('SoundCloud API error:', error);
      return [];
    }
  });

  ipcMain.handle('search-soundcloud', async (event, query) => {
    try {
      const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
        params: {
          q: query,
          client_id: SOUNDCLOUD_CONFIG.CLIENT_ID,
          limit: 10,
          offset: 0,
          linked_partitioning: 1
        },
        headers: {
          'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT
        }
      });

      return response.data.collection.map(item => ({
        id: item.id.toString(),
        title: item.title,
        artist: item.user.username || 'Unknown Artist',
        cover: item.artwork_url ? item.artwork_url.replace('large', 't500x500') : null,
        duration: item.duration,
        streamUrl: item.permalink_url,
        isSoundCloud: true
      }));
    } catch (error) {
      console.error('SoundCloud search error:', error);
      return [];
    }
  });

  ipcMain.handle('get-soundcloud-stream', async (event, trackId) => {
    return await getSoundCloudStream(trackId);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});