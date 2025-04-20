from textblob import TextBlob

def detect_mood(text:str):
    if not text.strip():
        return None
    
    blob = TextBlob(text)
    sentiment_polarity = blob.sentiment.polarity
    sentiment_subjectivity = blob.sentiment.subjectivity
    
    if sentiment_polarity > 0.2:
        if sentiment_subjectivity > 0.5:
            return "Excited/Joyful"
        else:
            return "Generally Positive"
    elif sentiment_polarity < -0.2:
        if sentiment_subjectivity > 0.5:
            return "Sad/Angry"
        else:
            return "Generally Negative"
    else:
        if sentiment_subjectivity > 0.5:
            return "Neutral/Ambivalent"
        else:
            return "Calm/Peaceful"