from flask import Flask, session, render_template, url_for, redirect, jsonify, request
import os
from dotenv import load_dotenv
load_dotenv()
import spotify  # Your spotify.py module
from mood import detect_mood  # Your mood.py module
from datetime import timedelta
from functools import wraps
import time
from spotipy.cache_handler import CacheFileHandler
from spotipy.oauth2 import SpotifyOAuth

app = Flask(__name__)
app.secret_key=os.getenv("FLASK_SECRET_KEY")
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1) 


# Cache configuration
def get_cache_handler():
    return CacheFileHandler(cache_path=".cache", username=session.get("user_id", "default"))

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
            return redirect(url_for('index'))  # Redirect to login page
        return f(*args, **kwargs)
    return decorated_function

@app.route('/', methods=['GET'])
def index():
    is_authenticated = 'access_token' in session
    return render_template('index.html', is_authenticated=is_authenticated)

@app.route('/login')
def login():
    auth_url = spotify.authorize_url()
    return redirect(auth_url)

@app.route('/login/callback')
def callback():
    code = request.args.get('code')
    if not code:
        return "Authorization code missing", 400
    
    try:
        token_info = spotify.access_token(code)
        sp = spotify.get_spotify_client(token_info['access_token'])
        user_info = sp.me()
        session.permanent = True
        session['user_id'] = user_info['id']
        session['access_token'] = token_info['access_token']
        session['refresh_token'] = token_info.get('refresh_token')
        
        # Save tokens to cache
        cache_handler = get_cache_handler()
        cache_handler.save_token_to_cache(token_info)
        
        return redirect(url_for('index'))
    except Exception as e:
        print(f"Callback error: {e}")
        return "Authentication failed", 400

@app.route('/get_token')
@login_required
def get_token():
    try:
        cache_handler = get_cache_handler()
        token_info = cache_handler.get_cached_token()
        if time.time() > token_info['expires_at'] - 60:
            new_token = spotify.refresh_token(token_info['refresh_token'])
            cache_handler.save_token_to_cache(new_token)
            token_info = new_token
            
        return jsonify({
            'token': token_info['access_token'],
            'expires_at': token_info['expires_at']
        })
    except Exception as e:
        print(f"Token error: {e}")
        return jsonify(error="Token unavailable"), 401
    
@app.route("/get_recommendations", methods=['POST'])
@login_required
def get_recommendations():
    try:
        print("Current Access Token:", session['access_token'])
        sp = spotify.get_spotify_client(session['access_token'])
        user_feeling = request.form['mood_text']
        mood_text = detect_mood(user_feeling)  # Call your mood detection function
        print(f"Mood:{user_feeling}")
        tracks = spotify.recommendations(sp, mood_text=mood_text, limit=20) or []
        track_list = []
        if tracks:
            for track in tracks:
                track_info = {
                    'id': track['id'],
                    'name': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'album': track['album']['name'],
                    'preview_url': track.get('preview_url'),
                    'spotify_url': track['external_urls']['spotify'],
                    'image': track['album']['images'][0]['url'] if track['album']['images'] else None
                }
                track_list.append(track_info)
        print(f"songs:{track_list}")
        return render_template('song.html', tracks=track_list, mood=mood_text, premium_user=spotify.check_user_premium(sp))
    except Exception as e:
        print(f"Recommendation error: {e}")
        return render_template('song.html', error="Couldn't generate recommendations based on mood.")
    
@app.route('/logout')
def logout():
    session.clear()
    cache_handler = get_cache_handler()
    if os.path.exists(cache_handler.cache_path):
        os.remove(cache_handler.cache_path)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
