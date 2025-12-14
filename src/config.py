from dotenv import load_dotenv

import os

import secrets

load_dotenv()

JWT_KEY = os.getenv('JWT_KEY')

DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')

DB_NAME = os.getenv('DB_NAME')

DB_USER = os.getenv('DB_USER')
DB_PASS = os.getenv('DB_PASS')