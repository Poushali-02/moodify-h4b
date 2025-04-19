import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from spotify import create_spotify_oauth, get_spotify_token, get_spotify_client, is_premium_user, get_recommendations_by_mood, format_track_response
from dotenv import load_dotenv
from datetime import timedelta
from mood import get_mood

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
app.permanent_session_lifetime = timedelta(days=30)

@app.before_request
def make_session_permanent():
    session.permanent = True

@app.route("/")
def main():
    token_info = session.get("token_info")
    is_authenticated = token_info if token_info else None
    return render_template("index.html", is_authenticated=is_authenticated)

@app.route("/login")
def login():
    sp_oauth = create_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)


@app.route("/login/callback")
def callback():
    sp_oauth = create_spotify_oauth()
    code = request.args.get('code')
    if code:
        token_info = sp_oauth.get_access_token(code)
        session['token_info'] = token_info
        return redirect(url_for('main'))
    else:
        return redirect(url_for('main'))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route("/api/token")
def get_token():
    token_info = session.get('token_info')
    if token_info:
        return jsonify({'token': token_info['access_token']})
    else:
        return jsonify({'error': 'No token found in session'}), 401
    
@app.route("/mood", methods=['POST'])
def process_mood():
    if not session.get("token_info"):
        return redirect(url_for("login"))
    user_text = request.form.get('mood_text',"")
    mood = get_mood(user_text)
    session['current_mood'] = mood
    session['mood_text'] = user_text
    return redirect(url_for('songs'))

@app.route("/songs")
def songs():
    if not session.get('token_info'):
        return redirect(url_for('login'))
    
    mood = session.get('current_mood')
    mood_text = session.get('mood_text')
    if not mood:
        return redirect(url_for('main'))
    sp = get_spotify_client()
    premium = is_premium_user(sp)
    
    tracks = get_recommendations_by_mood(sp, mood)
    
    formatted_tracks = [format_track_response(track, premium) for track in tracks]
    
    return render_template('song.html', 
                          mood=mood, 
                          mood_text=mood_text,
                          tracks=formatted_tracks,
                          is_premium=premium)

@app.route("/api/now_playing")
def playing():
    if not session.get('token_info'):
        return jsonify({"error": "Not authenticated"}), 401
    
    sp = get_spotify_client()
    try:
        current = sp.current_playback()
        if current and current.get('item'):
            track = current['item']
            return jsonify({
                "is_playing": current['is_playing'],
                "track": format_track_response(track, True)
            })
        else:
            return jsonify({"is_playing": False, "track": None})
    except:
        return jsonify({"error": "Could not fetch now playing"}), 500

if __name__ == "__main__":
    app.run(debug=True)