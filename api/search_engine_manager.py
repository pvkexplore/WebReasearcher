from typing import Dict, Optional, List, Any
from datetime import datetime
from queue import Queue
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from Self_Improving_Search import EnhancedSelfImprovingSearch, SearchMessage
from .models import WebSocketMessage

class WebSocketMessageHandler:
    """Handles message routing to WebSocket queues"""
    def __init__(self, session_id: str, message_queues: Dict[str, Queue]):
        self.session_id = session_id
        self.message_queues = message_queues
        self.sources_analyzed = 0
        self.current_focus = None
        self.research_details = {
            "urls_accessed": set(),
            "successful_urls": set(),
            "failed_urls": set(),
            "content_summaries": []
        }

    def send_progress_update(self, stage: str, message: str, data: Optional[Dict] = None) -> None:
        """Send a progress update through the WebSocket"""
        if self.session_id not in self.message_queues:
            return

        queue = self.message_queues[self.session_id]
        queue.put({
            "type": "progress",
            "message": message,
            "data": {
                "current_focus": self.current_focus,
                "sources_analyzed": self.sources_analyzed,
                "stage": stage,
                "research_details": {
                    "urls_accessed": list(self.research_details["urls_accessed"]),
                    "successful_urls": list(self.research_details["successful_urls"]),
                    "failed_urls": list(self.research_details["failed_urls"]),
                    "content_summaries": self.research_details["content_summaries"]
                },
                **(data or {})
            },
            "timestamp": datetime.now().isoformat()
        })

    def handle_message(self, message: SearchMessage) -> None:
        """Route search messages to WebSocket queue with enhanced progress tracking"""
        if self.session_id not in self.message_queues:
            print(f"No message queue found for session {self.session_id}")
            return

        queue = self.message_queues[self.session_id]
        
        # Track progress based on message content
        if "Scraping selected pages" in message.message:
            self.send_progress_update("scraping", message.message)
        elif "Successfully scraped:" in message.message:
            self.sources_analyzed += 1
            url = message.message.replace("Successfully scraped:", "").strip()
            self.research_details["urls_accessed"].add(url)
            self.research_details["successful_urls"].add(url)
            if message.data and "content" in message.data:
                self.research_details["content_summaries"].append({
                    "url": url,
                    "summary": message.data["content"][:200] + "..."  # Store summary
                })
            self.send_progress_update("analyzing", message.message)
        elif "Failed to scrape:" in message.message or "Robots.txt disallows scraping of" in message.message:
            url = message.message.split()[-1].strip()
            self.research_details["urls_accessed"].add(url)
            self.research_details["failed_urls"].add(url)
            # Don't update stage for failed scrapes
            self.send_progress_update("scraping", "Continuing with available sources...")
        elif "Search attempt" in message.message:
            self.send_progress_update("searching", message.message)
        elif "Formulated query:" in message.message:
            query = message.message.replace("Formulated query:", "").strip()
            self.current_focus = {
                "area": query,
                "priority": 1
            }
            self.send_progress_update("querying", message.message)
        elif "Thinking" in message.message:
            self.send_progress_update("thinking", message.message)
        elif "Evaluating content" in message.message:
            self.send_progress_update("evaluating", message.message)
        else:
            # Pass through other messages with current progress state
            queue.put({
                "type": message.type,
                "message": message.message,
                "data": {
                    "current_focus": self.current_focus,
                    "sources_analyzed": self.sources_analyzed,
                    "research_details": {
                        "urls_accessed": list(self.research_details["urls_accessed"]),
                        "successful_urls": list(self.research_details["successful_urls"]),
                        "failed_urls": list(self.research_details["failed_urls"]),
                        "content_summaries": self.research_details["content_summaries"]
                    },
                    **(message.data or {})
                },
                "timestamp": message.timestamp
            })

class AsyncSearchEngine(EnhancedSelfImprovingSearch):
    """Extends EnhancedSelfImprovingSearch with WebSocket integration"""
    def __init__(
        self,
        llm: LLMWrapper,
        parser: UltimateLLMResponseParser,
        session_id: str,
        message_queues: Dict[str, Queue],
        message_processing_tasks: Dict[str, bool],
        settings: Dict[str, Any]
    ):
        # Initialize message handler for WebSocket communication
        self.message_handler = WebSocketMessageHandler(session_id, message_queues)
        
        # Initialize parent class with message handler
        super().__init__(llm, parser, message_handler=self.message_handler)
        
        # Store additional attributes
        self.session_id = session_id
        self.message_queues = message_queues
        self.message_processing_tasks = message_processing_tasks
        self.settings = settings
        self.research_paused = False
        self.stop_requested = False

    def perform_single_search(self, query: str) -> Optional[str]:
        """Perform a single search with progress updates"""
        try:
            # Update status for query formulation
            self.message_handler.send_progress_update(
                "formulating",
                "Formulating search query...",
                {"query": query}
            )

            # Use parent class's methods for actual search
            formulated_query, time_range = self.formulate_query(query, 0)
            
            # Update status for search
            self.message_handler.send_progress_update(
                "searching",
                f"Searching with query: {formulated_query}",
                {"query": formulated_query}
            )

            results = self.perform_search(formulated_query, time_range)
            if not results:
                return "No results found."

            # Update status for page selection
            self.message_handler.send_progress_update(
                "selecting",
                "Selecting relevant pages...",
                {"results_count": len(results)}
            )

            selected_urls = self.select_relevant_pages(results, query)
            if not selected_urls:
                return "No relevant pages found."

            # Update status for content scraping
            self.message_handler.send_progress_update(
                "scraping",
                "Retrieving content from selected pages...",
                {"urls_count": len(selected_urls)}
            )

            scraped_content = self.scrape_content(selected_urls)
            if not scraped_content:
                return "Failed to retrieve content."

            # Update status for answer generation
            self.message_handler.send_progress_update(
                "generating",
                "Generating answer from collected information...",
                {"content_length": sum(len(c) for c in scraped_content.values())}
            )

            return self.generate_final_answer(query, scraped_content)

        except Exception as e:
            print(f"Error in single search: {e}")
            return f"Search error: {str(e)}"

    def search_and_improve(self, query: str) -> None:
        """Main search function with WebSocket integration"""
        try:
            # Get message queue
            message_queue = self.message_queues.get(self.session_id)
            if not message_queue:
                raise ValueError(f"No message queue found for session {self.session_id}")

            # Update initial status
            self.message_handler.send_progress_update(
                "initializing",
                "Starting research process...",
                {"query": query}
            )

            # Determine search mode
            is_research_mode = self.settings.get("searchMode") == "research"

            if is_research_mode:
                # Use parent class's search_and_improve for research mode
                result = super().search_and_improve(query)
            else:
                # Simple search mode
                result = self.perform_single_search(query)

            # Send final result with research details
            if result:
                message_queue.put({
                    "type": "result",
                    "message": result,
                    "data": {
                        "result": result,
                        "sources_analyzed": self.message_handler.sources_analyzed,
                        "current_focus": self.message_handler.current_focus,
                        "research_details": {
                            "urls_accessed": list(self.message_handler.research_details["urls_accessed"]),
                            "successful_urls": list(self.message_handler.research_details["successful_urls"]),
                            "failed_urls": list(self.message_handler.research_details["failed_urls"]),
                            "content_summaries": self.message_handler.research_details["content_summaries"]
                        }
                    },
                    "timestamp": datetime.now().isoformat()
                })

            # Update final status
            message_queue.put({
                "type": "status",
                "data": {
                    "status": "completed",
                    "sources_analyzed": self.message_handler.sources_analyzed,
                    "current_focus": self.message_handler.current_focus,
                    "research_details": self.message_handler.research_details
                },
                "timestamp": datetime.now().isoformat()
            })

        except Exception as e:
            print(f"Error in search_and_improve: {e}")
            if message_queue:
                message_queue.put({
                    "type": "error",
                    "message": f"Search error: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                })

    def stop(self) -> None:
        """Stop the search process"""
        self.stop_requested = True
        self.research_paused = False
        
        # Send stop status
        message_queue = self.message_queues.get(self.session_id)
        if message_queue:
            message_queue.put({
                "type": "status",
                "data": {
                    "status": "stopped",
                    "sources_analyzed": self.message_handler.sources_analyzed,
                    "current_focus": self.message_handler.current_focus,
                    "research_details": self.message_handler.research_details
                },
                "timestamp": datetime.now().isoformat()
            })
