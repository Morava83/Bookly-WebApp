from flask import Blueprint

#Create Blueprint Object
type1_blueprint = Blueprint('Type1', __name__)

#Rout inside blueprint
@type1_blueprint.route('/process1/<data>')

def process(data):
    # bare minimum placeholder logic
    return f"Type1 processed {data}"

#def RequestMeeting(msg):