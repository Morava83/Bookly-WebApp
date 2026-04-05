from flask import Flask, render_template
from backend.Type1 import type1_blueprint
# from backend.Type2 import type2_blueprint
# from backend.Type3 import type3_blueprint

app = Flask(__name__)

# Register blueprint
app.register_blueprint(type1_blueprint)

@app.route("/")
#LOGIN PAGE
def login():
    return render_template('Landing&LoginPage.html')

# CREATE ACCOUNT PAGE
def create_account():
    return render_template('CreateAccountPage.html')

def home():
    return render_template('HomePage.html')
    #return "<h1>Hello from Flask!</h1>"

if __name__ == "__main__":
    #print("hello world")
    app.run(debug=False)  # <- This starts the server

