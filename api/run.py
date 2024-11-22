import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from main import app
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        # Add CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:3000"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Log startup message
        logger.info("Starting Research API server...")
        logger.info("CORS configured for: http://localhost:3000")
        logger.info("WebSocket endpoint available at: ws://localhost:8000/ws/{session_id}")
        logger.info("API documentation available at: http://localhost:8000/docs")

        # Run the FastAPI application
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,  # Enable auto-reload during development
            workers=1,    # Use single worker for WebSocket support
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        raise
