import secrets

token = secrets.token_hex(32)

with open(".env","a") as f:
    f.write(f"FLASK_SECRET_KEY={token}")
    print("done and dusted")