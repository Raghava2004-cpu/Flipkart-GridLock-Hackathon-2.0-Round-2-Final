# Here are your Instructions


TCIE — Traffic Congestion Intelligence Engine
Local Run Instructions for Judges
1. Prerequisites

Ensure you have the following installed on your local machine:

Python 3.11+

Node.js 20+ & Yarn

MongoDB Atlas account (or a local MongoDB instance running)

If Yarn is not installed, install it globally via npm:

Bash
npm install -g yarn


2. Extract and Navigate to Project

If you downloaded the submission as a ZIP file from GitHub, extract it and navigate to the project root:

Bash
unzip Flipkart-GridLock-Hackathon-2.0-Round-2-Final-main.zip
cd Flipkart-GridLock-Hackathon-2.0-Round-2-Final-main


3. Database Configuration (MongoDB)

This application supports both cloud-hosted MongoDB Atlas and local MongoDB setups.

Option A (Recommended): MongoDB Atlas Have your Atlas connection URI ready. You will paste this into the backend environment configuration in the next step.

Option B: Local MongoDB / Docker If running locally, ensure it is exposed on mongodb://localhost:27017. Alternatively, spin up a quick Docker container:

Bash
docker run -d --name tcie-mongo -p 27017:27017 mongo:7

4. Backend Setup

Open a terminal window at the project root and run the following commands:

For macOS / Linux:

Bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-deploy.txt
cp .env.example .env


For Windows (PowerShell):

PowerShell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-deploy.txt
copy .env.example .env


Configure Backend Environment Variables

Open the newly created backend/.env file and update the configurations:

Code snippet
MONGO_URL=your_mongodb_atlas_connection_string_or_local_url
DB_NAME=traffic_management
CORS_ORIGINS=http://localhost:3000
MAPPLS_KEY=YOUR_MAPMYINDIA_API_KEY


Start the Backend Server

Bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload


Health Check: Verify the backend is up by visiting http://localhost:8001/api/ or running:

Bash
curl http://localhost:8001/api/


Expected Response: {"service":"Traffic Congestion Intelligence Engine","status":"ok"}

5. Frontend Setup

Open a second terminal window at the project root:

Bash
cd frontend
yarn install
cp .env.example .env  # Use 'copy' instead of 'cp' on Windows CMD


Configure Frontend Environment Variables

Open frontend/.env and update the values:

Code snippet
REACT_APP_BACKEND_URL=http://localhost:8001
REACT_APP_MAPPLS_KEY=YOUR_MAPMYINDIA_API_KEY
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false


Start the Frontend Application

Bash
yarn start


The application should automatically open in your browser at http://localhost:3000.

6. Step-by-Step Testing Guide

To verify the engine's core functionality, follow these evaluation steps:

Navigate to http://localhost:3000 in your web browser.

In the Incident Form, input the following test address:

Plaintext
Jalahalli Cross Junction, Peenya


Fill out or keep the default mock parameters:

Event Cause: Vehicle Breakdown

Priority: High

Weather: Clear

Time of Day: Midday Off-peak

Click Predict & Dispatch.

Expected Outcome: The intelligence engine will parse the request and return live calculations:

Predicted incident clearance time.

Resource deployment matrix (Nearest police station, required officer count, barricade count, and emergency vehicle/crane routing).

An interactive map marker pinpointing the location along with an update to the active incident queue.

7. Troubleshooting & Common Fixes

Backend MongoDB Connection Error: Ensure your MongoDB Atlas IP Whitelist allows access from your current location, or verify your local/Docker container is healthy using docker ps.

Frontend-to-Backend Network Errors: Check frontend/.env and ensure REACT_APP_BACKEND_URL is set strictly to http://localhost:8001. Do not append /api to the end of this string, as the internal API client handles route grouping natively.

Map/Mappls SDK Fails to Render: Ensure you have supplied a valid MapmyIndia API Key in both .env files and that your machine has an active internet connection to fetch the external web SDK components.

Yarn Dependency Conflicts: If you encounter environment caching issues, clean package artifacts and reinstall:

Bash
rm -rf node_modules yarn.lock
yarn install
yarn start

8. Project Directory Structure

Plaintext
├── backend/
│   ├── server.py                 # FastAPI Main Application Gateway
│   ├── requirements-deploy.txt   # Core Python Dependencies
│   ├── data/
│   │   └── traffic.csv           # Engine training/simulation dataset
│   └── engine/
│       ├── geocode.py            # Spatial coordinate parsing
│       ├── graph_engine.py       # Network routing graph routing
│       ├── ml_engine.py          # Congestion & clearance predictive models
│       └── rl_engine.py          # Reinforcement learning dispatch optimizer
├── frontend/
│   ├── package.json
│   ├── yarn.lock
│   ├── src/                      # React UI Components and Application Logic
│   └── public/                   # Static application assets
├── Dockerfile
└── README.md


9. Quick-Start Terminal Cheatsheet

Terminal 1 (Backend):

Bash
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements-deploy.txt
cp .env.example .env  # Update MONGO_URL and MAPPLS_KEY here
uvicorn server:app --host 0.0.0.0 --port 8001 --reload


Terminal 2 (Frontend):

Bash
cd frontend && yarn install
cp .env.example .env  # Update REACT_APP_MAPPLS_KEY here
yarn start


