#Type3: Recurring Office Hours
from flask import Blueprint, request, current_app, jsonify

type3_blueprint = Blueprint('Type3', __name__)

#LOGIC

#---------Media Query-----------
#Get available slots from timeSlot table


#---------Create Meeting---------
#User picks slots to book appointment
#Email is sent to owner
#Possibly include zoom link in email

#Booking must appear on user and owner dashboard

#----------Database------------
#Update Booking table with a modification (insert) command