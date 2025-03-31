document.addEventListener('DOMContentLoaded', async () => {
    const tracksList = document.getElementById('tracks-list');
    const importBtn = document.getElementById('import-btn');
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentCover = document.getElementById('current-cover');
    const currentTrackTitle = document.getElementById('current-track');
    const currentTrackArtist = document.getElementById('current-artist');
    const progressSlider = document.getElementById('progress-slider');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    const searchBar = document.getElementById('search-bar');

    const audio = new Audio();
    let currentTrack = null;
    let tracks = [];
    let soundCloudTracks = [];
    let isPlaying = false;
    let currentTrackIndex = -1;
    let likedTracks = await window.electronAPI.getLikedTracks();
    let playlists = await window.electronAPI.getPlaylists();
    let currentView = 'all';
    let showSoundCloudTracks = false;

    async function loadTracks() {
        tracks = await window.electronAPI.getTracks();
        tracks.forEach(track => {
            track.liked = likedTracks.includes(track.id);
        });
        renderTracks();
    }

    function renderTracks(filter = 'all') {
        tracksList.innerHTML = '';
        let filteredTracks = tracks;
        
        if (filter === 'liked') {
            filteredTracks = tracks.filter(track => track.liked);
        }
        
        filteredTracks.forEach((track, index) => {
            const trackItem = document.createElement('div');
            trackItem.className = 'track-item';
            trackItem.innerHTML = `
                <div class="track-cover" style="${track.cover ? `background-image: url('${track.cover}')` : ''}"></div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${track.artist}</div>
                </div>
                <div class="track-actions">
                    <button class="action-btn like-btn">
                        <i class="material-icons">${track.liked ? 'favorite' : 'favorite_border'}</i>
                    </button>
                    <button class="action-btn menu-btn">
                        <i class="material-icons">more_vert</i>
                    </button>
                    <div class="dropdown-menu">
                        <button class="dropdown-item add-to-playlist">Add to playlist</button>
                        <button class="dropdown-item remove-track">Remove track</button>
                    </div>
                </div>
            `;
            trackItem.addEventListener('click', () => playTrack(track, index));
            tracksList.appendChild(trackItem);
        });

        document.querySelectorAll('.like-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const track = filteredTracks[index];
                track.liked = !track.liked;
                
                if (track.liked) {
                    if (!likedTracks.includes(track.id)) {
                        likedTracks.push(track.id);
                    }
                } else {
                    likedTracks = likedTracks.filter(id => id !== track.id);
                }
                
                window.electronAPI.saveLikedTracks(likedTracks);
                btn.querySelector('.material-icons').textContent = track.liked ? 'favorite' : 'favorite_border';
            });
        });

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.nextElementSibling;
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    if (menu !== dropdown) menu.style.display = 'none';
                });
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
        });

        document.querySelectorAll('.add-to-playlist').forEach((btn, index) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const track = filteredTracks[index];
                const playlists = await window.electronAPI.getPlaylists();
                
                if (playlists.length === 0) {
                    alert('No playlists available. Create a playlist first.');
                    return;
                }
                
                const playlistName = prompt('Select playlist:\n' + 
                    playlists.map(p => `${p.name}`).join('\n'));
                
                const playlist = playlists.find(p => p.name === playlistName);
                if (playlist) {
                    await window.electronAPI.addToPlaylist(playlist.id, track.id);
                    alert(`Added to playlist: ${playlist.name}`);
                }
            });
        });

        document.querySelectorAll('.remove-track').forEach((btn, index) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const track = filteredTracks[index];
                if (confirm(`Are you sure you want to remove "${track.title}"?`)) {
                    const success = await window.electronAPI.removeTrack(track.id);
                    if (success) {
                        tracks = tracks.filter(t => t.id !== track.id);
                        renderTracks(currentView);
                    }
                }
            });
        });
    }

    function renderSoundCloudTracks() {
        tracksList.innerHTML = '';
        soundCloudTracks.forEach((track, index) => {
            const trackItem = document.createElement('div');
            trackItem.className = 'track-item soundcloud-track';
            trackItem.innerHTML = `
                <div class="track-cover" style="${track.cover ? `background-image: url('${track.cover.replace('large', 't500x500')}')` : ''}"></div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${track.artist}</div>
                    <div class="track-duration">${formatTime(track.duration / 1000)}</div>
                </div>
                <div class="track-actions">
                    <button class="action-btn like-btn">
                        <i class="material-icons">favorite_border</i>
                    </button>
                </div>
            `;
            trackItem.addEventListener('click', () => playSoundCloudTrack(track));
            tracksList.appendChild(trackItem);
        });

        document.querySelectorAll('.like-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const track = soundCloudTracks[index];
                btn.querySelector('.material-icons').textContent = 'favorite';
            });
        });
    }

    function playTrack(track, index = -1) {
        if (index >= 0) {
            currentTrackIndex = index;
        }
        
        currentTrack = track;
        audio.src = track.path;
        audio.play().catch(e => {
            console.error('Playback failed:', e);
        });
        isPlaying = true;
        
        currentTrackTitle.textContent = track.title;
        currentTrackArtist.textContent = track.artist;
        
        if (track.cover) {
            currentCover.style.backgroundImage = `url('${track.cover}')`;
            currentCover.style.backgroundSize = 'cover';
        } else {
            currentCover.style.backgroundImage = 'none';
            currentCover.style.backgroundColor = '#333333';
        }
        
        playBtn.innerHTML = '<i class="material-icons">pause</i>';
    }

    async function playSoundCloudTrack(track) {
        try {
          currentTrack = track;
          
          const streamUrl = await window.electronAPI.getSoundCloudStream(track.id);
          
          if (streamUrl) {
            audio.src = streamUrl;
          } else {
            audio.src = track.streamUrl;
          }
          
          audio.play().catch(e => {
            console.error('Playback failed:', e);
            alert('Failed to play SoundCloud track. Please try another one.');
          });
          
          isPlaying = true;
          currentTrackTitle.textContent = track.title;
          currentTrackArtist.textContent = track.artist;
          
          if (track.cover) {
            currentCover.style.backgroundImage = `url('${track.cover.replace('large', 't500x500')}')`;
            currentCover.style.backgroundSize = 'cover';
          } else {
            currentCover.style.backgroundImage = 'none';
            currentCover.style.backgroundColor = '#333333';
          }
          
          playBtn.innerHTML = '<i class="material-icons">pause</i>';
        } catch (error) {
          console.error('Error playing track:', error);
        }
      }

    function playNextTrack() {
        if (showSoundCloudTracks && soundCloudTracks.length > 0) {
            const nextIndex = (soundCloudTracks.findIndex(t => t.id === currentTrack?.id) + 1) % soundCloudTracks.length;
            playSoundCloudTrack(soundCloudTracks[nextIndex]);
        } else if (tracks.length > 0) {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            playTrack(tracks[nextIndex], nextIndex);
        }
    }

    function playPrevTrack() {
        if (showSoundCloudTracks && soundCloudTracks.length > 0) {
            const prevIndex = (soundCloudTracks.findIndex(t => t.id === currentTrack?.id) - 1 + soundCloudTracks.length) % soundCloudTracks.length;
            playSoundCloudTrack(soundCloudTracks[prevIndex]);
        } else if (tracks.length > 0) {
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            playTrack(tracks[prevIndex], prevIndex);
        }
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.textContent.includes('Liked')) {
                currentView = 'liked';
                renderTracks('liked');
                showSoundCloudTracks = false;
            } else if (btn.textContent.includes('Library')) {
                currentView = 'all';
                renderTracks('all');
                showSoundCloudTracks = false;
            } else if (btn.textContent.includes('Explore')) {
                window.electronAPI.getSoundCloudTracks().then(tracks => {
                    soundCloudTracks = tracks;
                    renderSoundCloudTracks();
                    showSoundCloudTracks = true;
                });
            } else {
                currentView = 'all';
                renderTracks('all');
                showSoundCloudTracks = false;
            }
        });
    });

    importBtn.addEventListener('click', async () => {
        const updatedTracks = await window.electronAPI.importTracks();
        if (updatedTracks.length > 0) {
            tracks = updatedTracks;
            renderTracks();
        }
    });

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            if (!currentTrack && tracks.length > 0) {
                playTrack(tracks[0], 0);
            } else if (!currentTrack && soundCloudTracks.length > 0) {
                playSoundCloudTrack(soundCloudTracks[0]);
            } else {
                audio.play();
            }
            isPlaying = true;
            playBtn.innerHTML = '<i class="material-icons">pause</i>';
        } else {
            audio.pause();
            isPlaying = false;
            playBtn.innerHTML = '<i class="material-icons">play_arrow</i>';
        }
    });

    nextBtn.addEventListener('click', playNextTrack);
    prevBtn.addEventListener('click', playPrevTrack);

    audio.addEventListener('timeupdate', () => {
        currentTime.textContent = formatTime(audio.currentTime);
        progressSlider.value = (audio.currentTime / audio.duration) * 100 || 0;
        updateProgressStyle();
    });

    audio.addEventListener('loadedmetadata', () => {
        totalTime.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('ended', playNextTrack);

    progressSlider.addEventListener('input', () => {
        const seekTime = (progressSlider.value / 100) * audio.duration;
        audio.currentTime = seekTime;
        updateProgressStyle();
    });

    volumeSlider.addEventListener('input', () => {
        audio.volume = volumeSlider.value / 100;
        updateVolumeStyle();
        volumeBtn.innerHTML = audio.volume === 0 ? 
            '<i class="material-icons">volume_off</i>' : 
            '<i class="material-icons">volume_up</i>';
    });

    volumeBtn.addEventListener('click', () => {
        if (audio.volume > 0) {
            audio.volume = 0;
            volumeSlider.value = 0;
        } else {
            audio.volume = 0.5;
            volumeSlider.value = 50;
        }
        updateVolumeStyle();
        volumeBtn.innerHTML = audio.volume === 0 ? 
            '<i class="material-icons">volume_off</i>' : 
            '<i class="material-icons">volume_up</i>';
    });

    searchBar.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length > 2) {
            soundCloudTracks = await window.electronAPI.searchSoundCloud(query);
            renderSoundCloudTracks();
            showSoundCloudTracks = true;
        } else if (showSoundCloudTracks) {
            renderTracks(currentView);
            showSoundCloudTracks = false;
        }
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function updateProgressStyle() {
        const value = (progressSlider.value / progressSlider.max) * 100;
        progressSlider.style.background = `linear-gradient(to right, #FF5500 ${value}%, #404040 ${value}%)`;
    }

    function updateVolumeStyle() {
        const value = (volumeSlider.value / volumeSlider.max) * 100;
        volumeSlider.style.background = `linear-gradient(to right, #FF5500 ${value}%, #404040 ${value}%)`;
    }

    updateProgressStyle();
    updateVolumeStyle();
    loadTracks();
});