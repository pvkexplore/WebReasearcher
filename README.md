# Web Researcher

A web-based interface for the AI-powered research assistant.

## Setup & Running

### Backend Setup

1. Navigate to the api directory:

```bash
cd api
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Start the FastAPI server:

```bash
python run.py
```

The backend server will run on http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install Node dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The frontend will run on http://localhost:3000

## Usage

1. Open your browser to http://localhost:3000
2. Enter your research query in the input field
3. Click "Start Research" to begin
4. View real-time updates in the message feed below
5. Use the "Stop" button to halt the research process if needed

## Development

- Backend API endpoints are in `api/main.py`
- Frontend React components are in `frontend/src/`
- WebSocket communication handles real-time updates
