// Variables
let player;
let deviceId;
let currentTrackId;
let isPlaying = false;
let accessToken = null;
let progressInterval;

// Main initialization function - checks premium status and sets up appropriate experience
document.addEventListener('DOMContentLoaded', () => {
    if (window.appData && window.appData.isPremium) {
        // Premium user flow - set up in-app playback
        setupPremiumExperience();
    } else {
        // Non-premium user flow - set up redirect links
        setupNonPremiumExperience();
    }
    
    // Set up mood filters for all users
    setupMoodFilters();
});

// Initialize premium user experience with Web Playback SDK
function setupPremiumExperience() {
    // Get access token first
    getAccessToken().then(token => {
        accessToken = token;
        
        // Load Spotify Web Playback SDK script
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
        
        // The Spotify Web Playback SDK is loaded asynchronously
        window.onSpotifyWebPlaybackSDKReady = () => {
            initializePlayer(token);
        };
    }).catch(error => {
        console.error('Failed to get access token:', error);
        showPlayerError('Authentication error. Please refresh the page or try logging in again.');
    });
}

// Setup experience for non-premium users (redirect links)
function setupNonPremiumExperience() {
    const trackCards = document.querySelectorAll('.track-card');
    trackCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Skip if they clicked the actual Spotify link
            if (e.target.classList.contains('spotify-link') || e.target.closest('.spotify-link')) {
                return;
            }

            // Find the Spotify link in this card and open it
            const spotifyLink = card.querySelector('.spotify-link');
            if (spotifyLink) {
                window.open(spotifyLink.href, '_blank');
            }
        });
    });
    
    // Show a message indicating premium is required for in-app playback
    const playerEl = document.getElementById('spotify-player');
    if (playerEl) {
        playerEl.innerHTML = `
            <div class="player-message">
                <p>Spotify Premium required for in-app playback.</p>
                <p>Click on any track to open in Spotify.</p>
            </div>
        `;
    }
}

// Initialize the Spotify Web Player
function initializePlayer(token) {
    // Create player instance
    player = new Spotify.Player({
        name: 'Moodify Web Player',
        getOAuthToken: callback => {
            // Use the token we already have or refresh if needed
            if (token) {
                callback(token);
            } else {
                getAccessToken().then(newToken => {
                    accessToken = newToken;
                    callback(newToken);
                }).catch(error => {
                    console.error('Failed to refresh token:', error);
                    showPlayerError('Session expired. Please refresh the page.');
                });
            }
        },
        volume: 0.5
    });

    // Connect to the player
    player.connect().then(success => {
        if (success) {
            console.log('The Web Playback SDK successfully connected to Spotify!');
        } else {
            console.error('Failed to connect to Spotify');
            showPlayerError('Failed to connect to Spotify. Please refresh the page.');
        }
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize', message);
        showPlayerError('Failed to initialize player: ' + message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate', message);
        showPlayerError('Authentication failed: ' + message);
        // Try to refresh token
        getAccessToken().then(newToken => {
            accessToken = newToken;
            // Reconnect player
            player.disconnect();
            setTimeout(() => player.connect(), 1000);
        }).catch(() => {
            showPlayerError('Session expired. Please refresh the page.');
        });
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate account', message);
        showPlayerError('Premium account required for playback. Please subscribe to Spotify Premium to use this feature.');
        // Switch to non-premium experience
        setupNonPremiumExperience();
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Failed to perform playback', message);
        showPlayerError('Playback error: ' + message + '. Please try again.');
    });

    // Playback status updates
    player.addListener('player_state_changed', state => {
        if (!state) {
            clearInterval(progressInterval);
            return;
        }

        currentTrackId = state.track_window.current_track.id;
        isPlaying = !state.paused;

        // Update UI to reflect the current track
        updatePlaybackUI(state);

        // Update player display
        updatePlayerDisplay(state.track_window.current_track);
        
        // Set up progress tracking
        clearInterval(progressInterval);
        if (isPlaying) {
            let currentPosition = state.position;
            const duration = state.duration;
            
            progressInterval = setInterval(() => {
                currentPosition += 1000; // Update every second
                if (currentPosition <= duration) {
                    updateProgressBar(currentPosition, duration);
                } else {
                    clearInterval(progressInterval);
                }
            }, 1000);
        }
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        deviceId = device_id;

        // Create player display
        createPlayerDisplay();

        // Enable play buttons on tracks
        enablePlayButtons();

        // Set as active device if possible
        transferPlaybackHere(device_id);
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
        deviceId = null;
        clearInterval(progressInterval);
        showPlayerError('Player disconnected. Please refresh the page.');
    });
}

// Create the player display
function createPlayerDisplay() {
    const playerEl = document.getElementById('spotify-player');
    if (playerEl) {
        playerEl.innerHTML = `
            <div class="player-display">
                <div class="now-playing">
                    <div class="track-image-small"></div>
                    <div class="track-info-small">
                        <div class="track-name-small">Select a track to play</div>
                        <div class="track-artist-small"></div>
                    </div>
                </div>
                <div class="player-controls">
                    <button id="previous-btn" class="control-btn">⏮</button>
                    <button id="play-btn" class="control-btn primary-btn">Play</button>
                    <button id="next-btn" class="control-btn">⏭</button>
                </div>
                <div class="player-progress">
                    <div class="progress-bar">
                        <div class="progress-filled"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners to player controls
        const playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', togglePlayback);
        }

        const prevBtn = document.getElementById('previous-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', playPrevious);
        }

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', playNext);
        }
        
        // Make progress bar clickable for seeking
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                if (!player || !deviceId) return;
                
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                
                // Get the current state to get duration
                player.getCurrentState().then(state => {
                    if (!state) return;
                    
                    const position = Math.floor(state.duration * percent);
                    
                    // Seek to position
                    fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}&device_id=${deviceId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }).catch(error => console.error('Error seeking:', error));
                });
            });
        }
    }
}

// Update the player display with current track
function updatePlayerDisplay(track) {
    if (!track) return;

    const trackImageEl = document.querySelector('.track-image-small');
    const trackNameEl = document.querySelector('.track-name-small');
    const trackArtistEl = document.querySelector('.track-artist-small');

    if (trackImageEl && track.album && track.album.images && track.album.images.length > 0) {
        trackImageEl.style.backgroundImage = `url(${track.album.images[0].url})`;
    }

    if (trackNameEl) {
        trackNameEl.textContent = track.name;
    }

    if (trackArtistEl) {
        trackArtistEl.textContent = track.artists.map(artist => artist.name).join(', ');
    }

    // Update play button text
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸' : '▶';
        playBtn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
    }
}

// Handle play button clicks on track cards
function enablePlayButtons() {
    const playButtons = document.querySelectorAll('.play-track-btn');

    playButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const uri = button.getAttribute('data-uri');
            playTrack(uri);
        });
    });

    // Make track cards clickable
    const trackCards = document.querySelectorAll('.track-card');
    trackCards.forEach(card => {
        card.addEventListener('click', () => {
            const playButton = card.querySelector('.play-track-btn');
            if (playButton) {
                playButton.click();
            }
        });
    });
}

// Play a specific track
function playTrack(uri) {
    if (!deviceId || !accessToken) return;

    // Show loading state
    const trackId = uri.split(':')[2];
    const trackCard = document.querySelector(`.track-card[data-track-id="${trackId}"]`);
    if (trackCard) {
        const playBtn = trackCard.querySelector('.play-track-btn');
        if (playBtn) {
            playBtn.textContent = 'Loading...';
            playBtn.disabled = true;
        }
    }

    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [uri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
    })
    .then(response => {
        // Reset button state
        if (trackCard) {
            const playBtn = trackCard.querySelector('.play-track-btn');
            if (playBtn) {
                playBtn.textContent = 'Play';
                playBtn.disabled = false;
            }
        }

        if (response.status === 204 || response.ok) {
            // Update UI immediately for better responsiveness
            document.querySelectorAll('.track-card').forEach(card => {
                card.classList.remove('playing');
            });
            if (trackCard) {
                trackCard.classList.add('playing');
            }
        } else if (response.status === 403) {
            showPlayerError('Playback failed - Insufficient Spotify Premium privileges.');
            // Switch to non-premium experience
            setupNonPremiumExperience();
        } else if (response.status === 401) {
            // Token expired, refresh
            getAccessToken().then(newToken => {
                accessToken = newToken;
                // Try again
                playTrack(uri);
            }).catch(error => {
                console.error('Error refreshing token:', error);
                showPlayerError('Session expired. Please refresh the page.');
            });
        } else {
            throw new Error('Failed to start playback');
        }
    })
    .catch(error => {
        console.error('Error playing track:', error);
        showPlayerError('Error playing track. Please try again.');
        
        // Reset button state
        if (trackCard) {
            const playBtn = trackCard.querySelector('.play-track-btn');
            if (playBtn) {
                playBtn.textContent = 'Play';
                playBtn.disabled = false;
            }
        }
    });
}

// Toggle play/pause
function togglePlayback() {
    if (!player) return;

    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.disabled = true;
    }

    player.togglePlay()
        .then(() => {
            if (playBtn) {
                // Will be updated by state change listener, but update immediately for better UX
                playBtn.textContent = isPlaying ? '▶' : '⏸';
                playBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error toggling playback:', error);
            showPlayerError('Error controlling playback');
            if (playBtn) {
                playBtn.disabled = false;
            }
        });
}

// Play previous track
function playPrevious() {
    if (!player) return;

    const prevBtn = document.getElementById('previous-btn');
    if (prevBtn) {
        prevBtn.disabled = true;
    }

    player.previousTrack()
        .then(() => {
            if (prevBtn) {
                prevBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error playing previous track:', error);
            showPlayerError('Error playing previous track');
            if (prevBtn) {
                prevBtn.disabled = false;
            }
        });
}

// Play next track
function playNext() {
    if (!player) return;

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.disabled = true;
    }

    player.nextTrack()
        .then(() => {
            if (nextBtn) {
                nextBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error playing next track:', error);
            showPlayerError('Error playing next track');
            if (nextBtn) {
                nextBtn.disabled = false;
            }
        });
}

// Update the UI based on playback state
function updatePlaybackUI(state) {
    if (!state) return;

    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.textContent = state.paused ? '▶' : '⏸';
        playBtn.setAttribute('title', state.paused ? 'Play' : 'Pause');
    }

    // Highlight the currently playing track
    const trackId = state.track_window.current_track.id;
    const trackCards = document.querySelectorAll('.track-card');
    trackCards.forEach(card => {
        const cardTrackId = card.getAttribute('data-track-id');
        if (cardTrackId === trackId) {
            card.classList.add('playing');
        } else {
            card.classList.remove('playing');
        }
    });

    // Update progress bar
    updateProgressBar(state.position, state.duration);
}

// Update progress bar
function updateProgressBar(position, duration) {
    const progressFilled = document.querySelector('.progress-filled');
    if (progressFilled && duration) {
        const percentage = (position / duration) * 100;
        progressFilled.style.width = `${percentage}%`;
    }
}

// Set this web player as the active device
function transferPlaybackHere(device_id) {
    if (!accessToken) return;

    fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            device_ids: [device_id],
            play: false
        })
    })
    .catch(error => console.error('Error transferring playback:', error));
}

// Get access token from server
async function getAccessToken() {
    try {
        const response = await fetch('/api/token');
        if (!response.ok) {
            throw new Error('Failed to get token');
        }
        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}

// Show player error message
function showPlayerError(message) {
    const playerEl = document.getElementById('spotify-player');
    if (playerEl) {
        // Preserve existing player if it exists
        const existingPlayer = playerEl.querySelector('.player-display');
        if (existingPlayer) {
            // Show error as a toast notification
            const errorToast = document.createElement('div');
            errorToast.className = 'player-error-toast';
            errorToast.textContent = message;
            document.body.appendChild(errorToast);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                errorToast.classList.add('fade-out');
                setTimeout(() => {
                    if (errorToast.parentNode) {
                        errorToast.parentNode.removeChild(errorToast);
                    }
                }, 500);
            }, 5000);
        } else {
            // No player exists, show error in player area
            playerEl.innerHTML = `<div class="player-error">${message}</div>`;
        }
    }
}

// Set up additional mood filters
function setupMoodFilters() {
    // Check if filters already exist
    if (document.querySelector('.filters-section')) {
        return;
    }
    
    // Create a filters section
    const mainElement = document.querySelector('main');
    const tracksContainer = document.querySelector('.tracks-container');

    if (mainElement && tracksContainer) {
        const filtersSection = document.createElement('div');
        filtersSection.className = 'filters-section';
        filtersSection.innerHTML = `
            <h3>Refine your mood:</h3>
            <div class="mood-filters">
                <button class="mood-filter active" data-mood="${window.appData && window.appData.mood ? window.appData.mood : 'neutral'}">
                    ${window.appData && window.appData.mood ? window.appData.mood.charAt(0).toUpperCase() + window.appData.mood.slice(1) : 'Neutral'}
                </button>
                <button class="mood-filter" data-mood="happy">Happy</button>
                <button class="mood-filter" data-mood="sad">Sad</button>
                <button class="mood-filter" data-mood="relaxed">Relaxed</button>
                <button class="mood-filter" data-mood="energetic">Energetic</button>
                <button class="mood-filter" data-mood="focused">Focused</button>
            </div>
        `;

        mainElement.insertBefore(filtersSection, tracksContainer);

        // Add event listeners to filters
        const filterButtons = document.querySelectorAll('.mood-filter');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Show loading state
                const tracksContainer = document.querySelector('.tracks-container');
                if (tracksContainer) {
                    tracksContainer.classList.add('loading');
                }

                // Get new mood recommendations
                const mood = button.getAttribute('data-mood');
                fetchMoodRecommendations(mood);
            });
        });
    }
}

// Fetch new recommendations based on mood
function fetchMoodRecommendations(mood) {
    fetch(`/api/recommendations?mood=${mood}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get recommendations');
            }
            return response.json();
        })
        .then(data => {
            updateTracksList(data.tracks);
            // Update mood display
            const moodTextElement = document.querySelector('.mood-text');
            if (moodTextElement) {
                moodTextElement.textContent = mood.charAt(0).toUpperCase() + mood.slice(1);
            }
            // Update window.appData.mood if it exists
            if (window.appData) {
                window.appData.mood = mood;
            }
            // Remove loading state
            const tracksContainer = document.querySelector('.tracks-container');
            if (tracksContainer) {
                tracksContainer.classList.remove('loading');
            }
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
            // Remove loading state
            const tracksContainer = document.querySelector('.tracks-container');
            if (tracksContainer) {
                tracksContainer.classList.remove('loading');
            }
            // Show error message
            const tracksList = document.querySelector('.tracks-list');
            if (tracksList) {
                tracksList.innerHTML = `<div class="error-message">Failed to load recommendations. Please try again.</div>`;
            }
        });
}

// Update the tracks list with new recommendations
function updateTracksList(tracks) {
    const tracksList = document.querySelector('.tracks-list');
    if (!tracksList) return;

    // Clear current tracks
    tracksList.innerHTML = '';

    if (!tracks || tracks.length === 0) {
        tracksList.innerHTML = `<div class="empty-message">No tracks found for this mood. Try another mood.</div>`;
        return;
    }

    // Add new tracks
    tracks.forEach(track => {
        const trackCard = document.createElement('div');
        trackCard.className = 'track-card';
        trackCard.setAttribute('data-track-id', track.id);

        trackCard.innerHTML = `
            <div class="track-image">
                ${track.image ?
                    `<img src="${track.image}" alt="${track.name}" loading="lazy">` :
                    `<div class="no-image">🎵</div>`
                }
            </div>
            <div class="track-info">
                <h3 class="track-name">${track.name}</h3>
                <p class="track-artist">${track.artist}</p>
                <p class="track-album">${track.album}</p>
                ${track.preview_url ? 
                    `<audio class="track-preview" src="${track.preview_url}" preload="none"></audio>` : 
                    ''}
            </div>
            <div class="track-actions">
                ${window.appData && window.appData.isPremium ?
                    `<button class="play-track-btn" data-uri="spotify:track:${track.id}">Play</button>` :
                    ''
                }
                <a href="${track.spotify_url}" target="_blank" class="btn outline-btn spotify-link">Open in Spotify</a>
            </div>
        `;

        tracksList.appendChild(trackCard);
    });

    // Re-enable play buttons if premium user
    if (window.appData && window.appData.isPremium) {
        enablePlayButtons();
    } else {
        // For non-premium users, ensure track card clicks open Spotify links
        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Skip if they clicked the actual Spotify link
                if (e.target.classList.contains('spotify-link') || e.target.closest('.spotify-link')) {
                    return;
                }
                const spotifyLink = card.querySelector('.spotify-link');
                if (spotifyLink) {
                    window.open(spotifyLink.href, '_blank');
                }
            });
        });
    }
}

// Add some CSS for the player error toast
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .player-error-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(255, 59, 48, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            animation: fadeIn 0.3s;
        }
        
        .player-error-toast.fade-out {
            animation: fadeOut 0.5s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; transform: translate(-50%, 0); }
            to { opacity: 0; transform: translate(-50%, 20px); }
        }
        
        .tracks-container.loading {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .empty-message, .error-message {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .error-message {
            color: #ff3b30;
        }
        
        .track-card.playing {
            box-shadow: 0 0 0 2px #1DB954;
        }
        
        .player-message {
            text-align: center;
            padding: 15px;
            background: #f7f7f7;
            border-radius: 8px;
            margin: 10px 0;
        }
    `;
    document.head.appendChild(style);
})();