import spotipy
from spotipy.oauth2 import SpotifyOAuth
import os
from dotenv import load_dotenv
from flask import session

load_dotenv()

SPOTIPY_CLIENT_ID=os.getenv("SPOTIPY_CLIENT_ID")
SPOTIPY_CLIENT_SECRET=os.getenv("SPOTIPY_CLIENT_SECRET")
SPOTIPY_REDIRECT_URI=os.getenv("SPOTIPY_REDIRECT_URI")
FLASK_SECRET_KEY=os.getenv("FLASK_SECRET_KEY")
SCOPE = "user-library-read user-read-email user-read-private streaming user-top-read playlist-read-private user-modify-playback-state"

# Mood to audio features mapping
MOOD_MAPPINGS = {
    'happy': {
        'min_valence': 0.7,
        'min_energy': 0.7,
        'target_mode': 1,  # Major key
    },
    'cheerful': {
        'min_valence': 0.5,
        'min_energy': 0.5,
        'target_mode': 1,  # Major key
    },
    'sad': {
        'max_valence': 0.3,
        'max_energy': 0.4,
        'target_mode': 0,  # Minor key
    },
    'melancholic': {
        'max_valence': 0.4,
        'min_valence': 0.2,
        'max_energy': 0.5,
        'target_mode': 0,  # Minor key
    },
    'relaxed': {
        'max_energy': 0.4,
        'min_valence': 0.4,
        'max_tempo': 100,
    },
    'energetic': {
        'min_energy': 0.8,
        'min_tempo': 120,
    },
    'focused': {
        'max_speechiness': 0.1,
        'target_instrumentalness': 0.5,
        'max_valence': 0.6,
    },
    'neutral': {
        'target_valence': 0.5,
        'target_energy': 0.5,
    }
}


def create_spotify_oauth():
    """Create the SpotifyOAuth object"""
    return SpotifyOAuth(
        client_id=SPOTIPY_CLIENT_ID,
        client_secret=SPOTIPY_CLIENT_SECRET,
        redirect_uri="http://127.0.0.1:5000/login/callback",
        scope=SCOPE,
        cache_path=None
    )
    

def get_spotify_token():
    """Retrieve the access token from session"""
    token_info = session.get('token_info')
    if not token_info:
        return None
    return token_info['access_token']

def get_spotify_client():
    """Get authenticated Spotify client"""
    token = get_spotify_token()
    if not token:
        return None
    return spotipy.Spotify(auth=token)

def is_premium_user(sp):
    """Check if the user has a premium account"""
    try:
        user_info = sp.current_user()
        return user_info.get('product') == 'premium'
    except:
        return False

def get_recommendations_by_mood(sp, mood, limit=10):
    if mood not in MOOD_MAPPINGS:
        mood = "neutral"
    seed_tracks = []
    seed_genres = []
    
    if mood == "happy" or mood == "cheerful":
        seed_genres = ["pop", "dance", "happy"]
    elif mood == "sad" or mood == "melancholic":
        seed_genres = ["sad", "indie", "alternative"]
    elif mood == "relaxed":
        seed_genres = ["ambient", "chill", "jazz"]
    elif mood == "energetic":
        seed_genres = ["edm", "dance", "rock"]
    elif mood == "focused":
        seed_genres = ["study", "classical", "ambient"]
    else:
        seed_genres = ["pop", "rock", "indie"]
    
    params = MOOD_MAPPINGS[mood].copy()
    
    try:
        results = sp.recommendations(seed_genres=seed_genres[:3], seed_tracks=seed_tracks[:2] if seed_tracks else [], 
                                   limit=limit, **params)
        return results['tracks']
    except Exception as e:
        print(f"Error getting recommendations: {e}")
        return []

def format_track_response(track, is_premium):
    return {
        "id": track['id'],
        "name": track['name'],
        "artist": track['artists'][0]['name'],
        "album": track['album']['name'],
        "image": track['album']['images'][0]['url'] if track['album']['images'] else None,
        "preview_url": track['preview_url'],
        "spotify_url": track['external_urls']['spotify'],
        "can_play_in_browser": is_premium and track['is_playable'] if 'is_playable' in track else is_premium
    }