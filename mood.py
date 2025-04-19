from textblob import TextBlob

def get_mood(text:str):
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    if polarity > 0.5:
        return "happy"
    elif polarity > 0.2:
        return "cheerful"
    elif polarity < -0.5:
        return "sad"
    elif polarity < -0.2:
        return "melancholic"
    elif subjectivity < 0.3 and -0.2 <= polarity <= 0.2:
        return "focused"
    elif polarity >= -0.2 and polarity <= 0.2:
        if "relax" in text.lower() or "calm" in text.lower() or "peace" in text.lower():
            return "relaxed"
        elif "energy" in text.lower() or "excit" in text.lower() or "dance" in text.lower():
            return "energetic"
        else:
            return "neutral"