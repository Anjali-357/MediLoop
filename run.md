# MediLoop - Run Instructions

Follow these steps to set up and run the MediLoop application (which includes all 4 modules: ScribeAI, RecoverBot, PainScan, and CareGap).

## 1. Prerequisites
Make sure you have the following installed on your system:
- Docker & Docker Compose
- Python 3.11
- Node.js (v18 or v20) & npm

## 2. Infrastructure (MongoDB & Redis & Ollama)
Start the required background services using Docker Compose:
```bash
docker-compose up -d
```
*Note: Make sure port 27017 (MongoDB), 6379 (Redis), and 11434 (Ollama) are available.*

## 3. Backend Setup (FastAPI)
The backend is a FastAPI monolithic app.

1. Create a virtual environment:
   ```bash
   python3.11 -m venv venv
   ```
2. Activate the virtual environment:
   - On macOS/Linux: `source venv/bin/activate`
   - On Windows: `venv\Scripts\activate`
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up the Environment Variables:
   Ensure there is a `.env` file in the root directory containing necessary credentials:
   ```env
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB_NAME=mediloop
   GEMINI_API_KEY=your_gemini_api_key
   OLLAMA_BASE_URL=http://localhost:11434
   REDIS_URL=redis://localhost:6379
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   JWT_SECRET=mediloop_hackathon_secret
   FRONTEND_URL=http://localhost:5174
   ```
5. Run the backend server:
   ```bash
   uvicorn main:app --port 8000 --reload
   ```

## 4. Frontend Setup (React/Vite)
The frontend is a React application built with Vite.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *Note: If the default port 5173 is in use, verify the port output (e.g., `http://localhost:5174`). Update `FRONTEND_URL` in the `.env` if necessary.*

## 5. View the Application
Open your browser and navigate to the frontend URL (e.g., `http://localhost:5174`). You should be able to access all module routes (`/scribe`, `/recoverbot`, `/painscan`, `/caregap`).
