const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTracks: () => ipcRenderer.invoke('get-tracks'),
  importTracks: () => ipcRenderer.invoke('import-tracks'),
  saveLikedTracks: (likedTracks) => ipcRenderer.invoke('save-liked-tracks', likedTracks),
  getLikedTracks: () => ipcRenderer.invoke('get-liked-tracks'),
  createPlaylist: (name) => ipcRenderer.invoke('create-playlist', name),
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  addToPlaylist: (playlistId, trackId) => ipcRenderer.invoke('add-to-playlist', playlistId, trackId),
  removeTrack: (trackId) => ipcRenderer.invoke('remove-track', trackId),
  getSoundCloudTracks: () => ipcRenderer.invoke('get-soundcloud-tracks'),
  searchSoundCloud: (query) => ipcRenderer.invoke('search-soundcloud', query),
  getSoundCloudStream: (trackId) => ipcRenderer.invoke('get-soundcloud-stream', trackId)
  
});