from flask import Flask
import threading
import bot  # քո բոտի հիմնական ֆայլը, եթե անունը bot.py է

app = Flask(__name__)

@app.route('/')
def home():
    return "HAYQ Way Bot is running ✅"

def run_bot():
    bot.main()  # այստեղ պետք է լինի քո բոտի start ֆունկցիան

if __name__ == "__main__":
    threading.Thread(target=run_bot).start()
    app.run(host="0.0.0.0", port=5000)
