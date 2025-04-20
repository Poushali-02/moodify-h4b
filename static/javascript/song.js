// static/javascript/song.js
let player;
let deviceId;
let isPlaying = false;
let currentTrackUri = null;

// Token management
async function fetchToken() {
    try {
        const response = await fetch('/get_token');
        if (!response.ok) throw new Error('Token fetch failed');
        const { token } = await response.json();
        return token;
    } catch (error) {
        console.error('Token error:', error);
        window.location.href = '/login';
        return null;
    }
}

// Player initialization
async function initializePlayer() {
    const token = await fetchToken();
    if (!token) return;

    player = new Spotify.Player({
        name: 'Moodify Player',
        getOAuthToken: async (callback) => {
            try {
                const freshToken = await fetchToken();
                callback(freshToken);
            } catch (error) {
                console.error('Token refresh failed:', error);
            }
        },
        volume: 0.5
    });

    // Error handlers
    player.addListener('initialization_error', ({ message }) => {
        console.error('Initialization Error:', message);
    });

    player.addListener('authentication_error', async ({ message }) => {
        console.error('Auth Error:', message);
        await fetchToken();
        player.connect();
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account Error:', message);
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Playback Error:', message);
    });

    // Playback status
    player.addListener('ready', ({ device_id }) => {
        console.log('Device Ready:', device_id);
        deviceId = device_id;
        setupPlaybackControls();
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device Offline:', device_id);
        deviceId = null;
    });

    player.addListener('player_state_changed', state => {
        isPlaying = !state?.paused;
        updatePlayPauseIcon();
        updateTrackInfo(state?.track_window?.current_track);
    });

    player.connect();
}

// Playback controls setup
function setupPlaybackControls() {
    const playPauseButton = document.querySelector('.fixed-player .play-pause-btn');
    const nextTrackButton = document.querySelector('.fixed-player .next-track-btn');
    const prevTrackButton = document.querySelector('.fixed-player .prev-track-btn');

    if (playPauseButton) {
        playPauseButton.addEventListener('click', async () => {
            if (!deviceId) return;
            try {
                if (isPlaying) {
                    await player.pause();
                } else {
                    if (currentTrackUri) await playTrack(currentTrackUri);
                }
            } catch (error) {
                console.error('Playback control error:', error);
            }
        });
    }

    if (nextTrackButton) {
        nextTrackButton.addEventListener('click', () => {
            player.nextTrack();
        });
    }

    if (prevTrackButton) {
        prevTrackButton.addEventListener('click', () => {
            player.previousTrack();
        });
    }

    // Event listeners for individual track play buttons
    const recommendationItems = document.querySelectorAll('.track-card');
    recommendationItems.forEach(item => {
        const playButton = item.querySelector('.play-recommendation-btn');
        const uri = item.dataset.uri;
        if (playButton) {
            playButton.addEventListener('click', () => {
                playTrack(uri);
            });
        }
    });
}

// Track playback
async function playTrack(uri) {
    currentTrackUri = uri;

    try {
        const token = await fetchToken();
        const response = await fetch(`https://www.spotify.com/premium/`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [uri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message);
        }

        isPlaying = true;
        updatePlayPauseIcon();
        // Fetch and update track info immediately after starting
        const state = await player.getCurrentState();
        updateTrackInfo(state?.track_window?.current_track);

    } catch (error) {
        console.error('Playback failed:', error);
        showErrorModal('Failed to start playback. Please try again.');
    }
}

// UI updates
function updatePlayPauseIcon() {
    const icon = document.querySelector('.fixed-player .play-pause-btn i');
    if (!icon) return;

    icon.classList.remove('fa-play', 'fa-pause');
    icon.classList.add(isPlaying ? 'fa-pause' : 'fa-play');
}

function updateTrackInfo(track) {
    if (!track) return;

    const artElement = document.querySelector('.fixed-player .track-art');
    const titleElement = document.querySelector('.fixed-player .track-title');
    const artistElement = document.querySelector('.fixed-player .track-artist');

    if (artElement) {
        artElement.style.backgroundImage = `url('${track.album.images[0]?.url}')`;
    }
    if (titleElement) {
        titleElement.textContent = track.name;
    }
    if (artistElement) {
        artistElement.textContent = track.artists.map(a => a.name).join(', ');
    }
}

function showErrorModal(message) {
    const modal = document.getElementById('error-modal');
    const messageElement = document.getElementById('error-message');

    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.style.display = 'block';
    }
}

// Initialize when SDK is ready
window.onSpotifyWebPlaybackSDKReady = initializePlayer;

// Close modal handler
const modalCloseButton = document.querySelector('.modal-close');
if (modalCloseButton) {
    modalCloseButton.addEventListener('click', () => {
        document.getElementById('error-modal').style.display = 'none';
    });
}