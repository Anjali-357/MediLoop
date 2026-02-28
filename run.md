# MediLoop - Run Instructions

The entire MediLoop platform is dockerized. You can launch the database, messaging queue, backend API, and frontend dashboard with one single command.

## 1. Prerequisites
Make sure you have the following installed on your system:
- Docker & Docker Compose

## 2. Environment Variables
Ensure there is a `.env` file in the root directory containing necessary credentials:
```env
# DO NOT CHANGE MONGO_URI OR REDIS_URL for Docker
MONGO_URI=mongodb://mongodb:27017
MONGO_DB_NAME=mediloop
REDIS_URL=redis://redis:6379

# Change these to your actual keys
GEMINI_API_KEY=your_gemini_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
JWT_SECRET=mediloop_hackathon_secret
```

## 3. Start Everything
From the root directory of the project, run:
```bash
docker-compose up -d --build
```

This will spin up 4 containers:
- `mediloop-mongodb` (Database on port 27017)
- `mediloop-redis` (Event Bus on port 6379)
- `mediloop-backend` (FastAPI backend on port 8000)
- `mediloop-frontend` (React dashboard on port 5174)

*Note: The first launch might take a couple of minutes to build the images and download the machine learning models internally.*

## 4. Seeding Mock Data
If you want to view the dashboards with pre-populated dummy patients, you need to seed the MongoDB database. 

Since the services are running inside Docker, run the seeder script from the host (assuming you're running it within a Python virtual environment):
```bash
export MONGO_URI=mongodb://localhost:27017
export MONGO_DB_NAME=mediloop
source venv/bin/activate
python RecoverBot/seed_database.py --wipe
```

## 5. View the Application
Open your browser and navigate to the frontend URL: http://localhost:5174. 
You can access all module routes (`/scribe`, `/recoverbot`, `/painscan`, `/caregap`).
