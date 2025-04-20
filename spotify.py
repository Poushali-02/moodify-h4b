from spotipy.client import Spotify
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import os
import spotipy

load_dotenv()

SPOTIPY_CLIENT_ID=os.getenv("SPOTIPY_CLIENT_ID")
SPOTIPY_CLIENT_SECRET=os.getenv("SPOTIPY_CLIENT_SECRET")
SPOTIPY_REDIRECT_URI=os.getenv("SPOTIPY_REDIRECT_URI")
scope = (
    "user-read-recently-played "
    "user-read-private user-read-email "
    "user-top-read playlist-modify-public "
    "user-follow-read "
    "playlist-modify-private user-read-playback-state "
    "user-modify-playback-state user-read-currently-playing "
    "streaming "
)
def get_spotify_oauth():
    return SpotifyOAuth(
        client_id=SPOTIPY_CLIENT_ID,
        client_secret=SPOTIPY_CLIENT_SECRET,
        redirect_uri=SPOTIPY_REDIRECT_URI,
        scope=scope
    )
    
def authorize_url():
    sp_oauth = get_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return auth_url

def access_token(code):
    sp_oauth = get_spotify_oauth()
    token_info = sp_oauth.get_access_token(code)
    return token_info

def refresh_token(refresh_token):
    sp_oauth = get_spotify_oauth()
    new_token_info = sp_oauth.refresh_access_token(refresh_token)
    return new_token_info

def get_spotify_client(access_token):
    if access_token:
        sp = Spotify(auth=access_token)
        return sp
    return None

def get_seed_artists(sp:Spotify) -> list[str]:
    followed_artist_ids = []
    artists = sp.current_user_followed_artists(limit=5)
    while artists:
        for artist in artists['artists']['items']:
            followed_artist_ids.append(artist['id'])
        if artists['artists']['next']:
            artists = sp.next(artists['artists'])
        else:
            artists = None
    return followed_artist_ids

def get_seed_genres(sp: Spotify) -> list[str]:
    all_genres = []
    results = sp.current_user_followed_artists(limit=5)
    while results:
        for artist in results['artists']['items']:
            if 'genres' in artist:
                all_genres.extend(artist['genres'])
        if results['artists']['next']:
            results = sp.next(results['artists'])
        else:
            results = None
    seed_genres = list(set(genre.lower() for genre in all_genres))
    return seed_genres

def get_seed_tracks(sp: Spotify, limit=10) -> list[str]:
    recently_played = sp.current_user_recently_played(limit=limit)
    track_ids = [item['track']['id'] for item in recently_played['items']]
    return track_ids

def recommendations(sp:Spotify, mood_text=None, limit=20):
    if not sp:
        print("Client not authorized")
        return None
    mood_to_params = {
        "Excited/Joyful": {
            "target_valence": 0.8, 
            "target_energy": 0.8, 
            "min_danceability": 0.6,
        },
        "Generally Positive": {
            "target_valence": 0.65, 
            "target_energy": 0.6,
            "min_danceability": 0.6,
            },
        "Sad/Angry": {
            "target_valence": 0.2, 
            "target_energy": 0.7, 
            "max_acousticness": 0.4
            },
        "Calm/Relaxed": {
            "target_energy": 0.3, 
            "target_acousticness": 0.8, 
            "max_danceability": 0.4
            },
        "Romantic": {
            "target_valence": 0.6, 
            "target_acousticness": 0.5, 
            "target_energy": 0.4, 
            "min_valence": 0.4
            },
        "Melancholy": {
            "target_valence": 0.3, 
            "target_acousticness": 0.6, 
            "max_energy": 0.4
            },
        "Focused/Productive": {
            "target_instrumentalness": 0.7, 
            "target_energy": 0.4, 
            "target_valence": 0.5
            },
        "Party/High Energy": {
            "target_energy": 0.9, 
            "target_valence": 0.75, 
            "min_danceability": 0.7
            },
        "Chill/Vibey": {
            "target_valence": 0.55, 
            "target_energy": 0.4, 
            "target_acousticness": 0.5
            },
        "Dark/Intense": {
            "target_valence": 0.2, 
            "target_energy": 0.8, 
            "target_mode": 0
            }
    }
    fallback_tracks = {
        "Excited/Joyful": ["1u8c2t2Cy7UBoG4ArRcF5g", "3AJwUDP919kvQ9QcozQPxg"],
        "Generally Positive": ["3AJwUDP919kvQ9QcozQPxg", "1u8c2t2Cy7UBoG4ArRcF5g"],
        "Sad/Angry": ["3YRCqOhFifThpSRFJ1VWFM", "7tFiyTwD0nx5a1eklYtX2J"],
        "Calm/Relaxed": ["6nek1Nin9q48AVZcWs9e9D", "5QDLhrAOJJdNAmCTJ8xMyW"],
        "Romantic": ["5QDLhrAOJJdNAmCTJ8xMyW", "6nek1Nin9q48AVZcWs9e9D"],
        "Melancholy": ["7tFiyTwD0nx5a1eklYtX2J", "3YRCqOhFifThpSRFJ1VWFM"],
        "Focused/Productive": ["3AJwUDP919kvQ9QcozQPxg", "6nek1Nin9q48AVZcWs9e9D"],
        "Party/High Energy": ["1u8c2t2Cy7UBoG4ArRcF5g", "3AJwUDP919kvQ9QcozQPxg"],
        "Chill/Vibey": ["6nek1Nin9q48AVZcWs9e9D", "5QDLhrAOJJdNAmCTJ8xMyW"],
        "Dark/Intense": ["3YRCqOhFifThpSRFJ1VWFM", "7tFiyTwD0nx5a1eklYtX2J"]
    }
    seed_track_ids = get_seed_tracks(sp)
    seed_artist_ids = get_seed_artists(sp)
    rec_params = mood_to_params.get(mood_text, {})
    seed_genres_from_followed = get_seed_genres(sp)
    payload = {'limit': limit, **rec_params}
    
    params = []
    if seed_artist_ids:
        params.extend([(id, 'artist') for id in seed_artist_ids])
    if seed_track_ids:
        params.extend([(id, 'track') for id in seed_track_ids])
    if seed_genres_from_followed:
        params.extend([(genre, 'genre') for genre in seed_genres_from_followed])

    if params:
        selected_seeds = params[:5]
        seed_artists = [seed for seed, type in selected_seeds if type == 'artist']
        seed_tracks = [seed for seed, type in selected_seeds if type == 'track']
        seed_genres = [seed for seed, type in selected_seeds if type == 'genre']
        if seed_artists:
            payload['seed_artists'] = seed_artists
        if seed_tracks:
            payload['seed_tracks'] = seed_tracks
        if seed_genres:
            payload['seed_genres'] = seed_genres
        print("Recommendation payload:", payload)
    try:
        recs = sp.recommendations(**payload)
        if recs and recs['tracks']:
            return recs['tracks']
        else:
            print("No recommendations found, returning fallback tracks.")
            return sp.tracks(fallback_tracks.get(mood_text, [])[:limit])['tracks']
    except Exception as e:
        print(f"Error fetching recommendations: {e}")
        print("Returning fallback tracks due to error.")
        return sp.tracks(fallback_tracks.get(mood_text, [])[:limit])['tracks']
    
def check_user_premium(sp:Spotify):
    if not sp:
        return False
    user_info = sp.me()
    if user_info and user_info.get('product') == 'premium':
        return True
    return False

def get_track_info(track):
    return {
        'name': track['name'],
        'artist': ', '.join([artist['name'] for artist in track['artists']]),
        'album': track['album']['name'],
        'image': track['album']['images'][0]['url'] if track['album']['images'] else None,
        'preview_url': track.get('preview_url'), # Ensure this is included
        'spotify_url': track['external_urls']['spotify']
    }