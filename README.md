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

## Technical Reference

### System Architecture

#### Core Components

1. **Self-Improving Search Engine** (`Self_Improving_Search.py`)

   - Implements iterative search and improvement algorithm
   - Integrates with LLM for query formulation and content analysis
   - Handles search result evaluation and refinement
   - Features automatic query reformulation based on results

2. **Research Manager** (`research_manager.py`)

   - Manages research sessions and state
   - Handles user interaction and command processing
   - Implements progress tracking and status updates
   - Provides conversation mode for interactive research

3. **Strategic Analysis Parser** (`strategic_analysis_parser.py`)
   - Analyzes research queries to identify focus areas
   - Assigns priorities to research topics
   - Calculates confidence scores for analysis quality
   - Validates and normalizes research focus areas

#### Backend Architecture

1. **FastAPI Server** (`api/main.py`)

   - RESTful endpoints for research operations
   - WebSocket support for real-time updates
   - Session management and background tasks
   - CORS middleware configuration

2. **LLM Integration** (`llm_wrapper.py`, `llm_config.py`)

   - Supports multiple LLM backends:
     - OpenAI-compatible endpoints
     - Ollama local models
   - Configurable parameters:
     - Temperature, top_p for response diversity
     - Context length and token limits
     - Stop sequences
   - Error handling and retry mechanisms

3. **Web Scraping** (`web_scraper.py`)
   - Ethical web scraping with robots.txt compliance
   - Rate limiting and concurrent requests
   - Content extraction and cleaning
   - Link resolution and validation

#### Frontend Architecture

1. **React Components**

   - StrategicAnalysis: Displays research focus areas
   - ResearchControls: Manages research process
   - ResearchProgress: Shows real-time updates
   - MessagesList: Displays research findings
   - Settings: Configures research parameters

2. **WebSocket Communication**
   - Real-time updates from backend
   - Progress monitoring
   - Research status updates
   - Error handling

### Key Features

1. **Strategic Research Analysis**

   - Breaks down research queries into focus areas
   - Prioritizes research directions
   - Calculates confidence scores
   - Provides reanalysis capabilities

2. **Self-Improving Search**

   - Iterative search refinement
   - Content relevance evaluation
   - Automatic query reformulation
   - Result quality assessment

3. **Real-time Updates**

   - WebSocket-based progress updates
   - Live research status monitoring
   - Interactive feedback
   - Error notifications

4. **Ethical Web Scraping**

   - robots.txt compliance
   - Rate limiting
   - Concurrent processing
   - Content extraction and cleaning

5. **LLM Integration**
   - Multiple backend support
   - Configurable parameters
   - Error handling
   - Response processing

### Data Flow

1. **Research Initiation**

   ```
   Frontend Query -> Strategic Analysis -> Focus Areas -> Search Process
   ```

2. **Search Process**

   ```
   Query Formulation -> Web Search -> Content Scraping -> LLM Analysis -> Result Generation
   ```

3. **Real-time Updates**
   ```
   Backend Events -> WebSocket -> Frontend Components -> User Interface
   ```

### Configuration

1. **LLM Settings** (`llm_config.py`)

   - Model selection
   - API endpoints
   - Generation parameters
   - Context limits

2. **Web Scraping** (`web_scraper.py`)

   - Rate limits
   - Concurrent requests
   - Content extraction rules
   - User agent configuration

3. **Frontend** (`frontend/src/`)
   - API endpoints
   - WebSocket configuration
   - UI customization
   - Error handling

### Development Guidelines

1. **Backend Development**

   - Follow FastAPI best practices
   - Implement proper error handling
   - Use async/await for performance
   - Maintain session management

2. **Frontend Development**

   - Use TypeScript for type safety
   - Follow React best practices
   - Implement proper error boundaries
   - Maintain responsive design

3. **LLM Integration**

   - Handle API limits and errors
   - Implement retry mechanisms
   - Validate responses
   - Monitor performance

4. **Web Scraping**
   - Follow robots.txt rules
   - Implement rate limiting
   - Handle network errors
   - Clean and validate content
