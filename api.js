const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SOUNDCLOUD_CONFIG = {
  CLIENT_ID: 'put ur client_id here',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const userDataPath = require('electron').app.getPath('userData');
const likedTracksPath = path.join(userDataPath, 'likedTracks.json');
const playlistsPath = path.join(userDataPath, 'playlists.json');

function getFileUrl(filePath) {
  if (!filePath) return null;
  return path.resolve(__dirname, filePath).replace(/\\/g, '/');
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
  if (!trackId) {
    console.error('Invalid trackId');
    return null;
  }

  try {

    const trackResponse = await axios.get(`https://api-v2.soundcloud.com/tracks/${trackId}`, {
      params: { client_id: SOUNDCLOUD_CONFIG.CLIENT_ID },
      headers: { 
        'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT,
        'Accept': 'application/json',
        'Origin': 'https://soundcloud.com',
        'Referer': 'https://soundcloud.com/'
      }
    });

    const transcodings = trackResponse.data.media?.transcodings;
    if (!transcodings || transcodings.length === 0) {
      throw new Error('No transcodings available');
    }


    let progressiveUrl = null;
    const progressiveTranscoding = transcodings.find(t => 
      t.format.protocol === 'progressive' && 
      t.format.mime_type.includes('audio/mpeg')
    );

    if (progressiveTranscoding) {
      const streamResponse = await axios.get(progressiveTranscoding.url, {
        params: { client_id: SOUNDCLOUD_CONFIG.CLIENT_ID },
        headers: { 'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT }
      });
      progressiveUrl = streamResponse.data?.url;
    }

    if (!progressiveUrl) {
      const hlsMp3Transcoding = transcodings.find(t => 
        t.format.protocol === 'hls' && 
        t.format.mime_type.includes('audio/mpeg')
      );

      if (hlsMp3Transcoding) {
        const streamResponse = await axios.get(hlsMp3Transcoding.url, {
          params: { client_id: SOUNDCLOUD_CONFIG.CLIENT_ID },
          headers: { 'User-Agent': SOUNDCLOUD_CONFIG.USER_AGENT }
        });
        progressiveUrl = streamResponse.data?.url;
      }
    }

    if (!progressiveUrl) {
      throw new Error('No supported stream format found');
    }

    const finalUrl = new URL(progressiveUrl);
    if (!finalUrl.searchParams.has('client_id')) {
      finalUrl.searchParams.set('client_id', SOUNDCLOUD_CONFIG.CLIENT_ID);
    }

    return finalUrl.toString();

  } catch (error) {
    console.error('Stream error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return null;
  }
}

async function getSoundCloudTracks() {
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
}

async function searchSoundCloud(query) {
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
      permalinkUrl: item.permalink_url,
      isSoundCloud: true
    }));
    
  } catch (error) {
    console.error('SoundCloud search error:', error);
    return [];
  }
}

module.exports = {
  scanTracks,
  saveLikedTracks,
  getLikedTracks,
  createPlaylist,
  getPlaylists,
  addToPlaylist,
  removeTrack,
  getSoundCloudStream,
  getSoundCloudTracks,
  searchSoundCloud
};
