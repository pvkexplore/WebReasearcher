from typing import Dict, List, Tuple, Optional
from datetime import datetime
import asyncio
from colorama import Fore, Style

from Self_Improving_Search import EnhancedSelfImprovingSearch, SearchMessage, MessageHandler
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser

class WebSocketMessageHandler(MessageHandler):
    """Handler that forwards messages to WebSocket clients"""
    def __init__(self, session_id: str, ws_manager):
        self.session_id = session_id
        self.ws_manager = ws_manager
        self.buffer = []

    def handle_message(self, message: SearchMessage) -> None:
        """Forward message to WebSocket clients"""
        try:
            # Print to console for debugging
            print(f"\nSending WebSocket message: {message.type} - {message.message[:100]}...")
            
            if message.type == 'error':
                print(f"{Fore.RED}{message.message}{Style.RESET_ALL}")
            elif message.type == 'result':
                print(f"{Fore.GREEN}{message.message}{Style.RESET_ALL}")
            else:
                print(message.message)

            # Store message in buffer
            self.buffer.append(message)
            
            # Get event loop
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Create WebSocket message
            ws_message = {
                "type": message.type,
                "message": message.message,
                "timestamp": message.timestamp,
                "data": message.data
            }
            
            # Broadcast message
            coroutine = self.ws_manager.broadcast(self.session_id, ws_message)
            
            # Run coroutine
            if loop.is_running():
                asyncio.create_task(coroutine)
            else:
                loop.run_until_complete(coroutine)

        except Exception as e:
            print(f"Error sending WebSocket message: {str(e)}")
            # Store error in buffer
            error_message = SearchMessage(
                type="error",
                message=f"Error sending message: {str(e)}",
                timestamp=datetime.now().isoformat()
            )
            self.buffer.append(error_message)

class WebSocketSearchEngine(EnhancedSelfImprovingSearch):
    """Search engine that sends updates through WebSocket"""
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, session_id: str, ws_manager):
        self.session_id = session_id
        self.message_handler = WebSocketMessageHandler(session_id, ws_manager)
        super().__init__(llm, parser, message_handler=self.message_handler)

    def _send_message(self, message: str, type: str = "info", data: Optional[Dict] = None) -> None:
        """Helper method to send messages through WebSocket"""
        if self.message_handler:
            self.message_handler.handle_message(SearchMessage(
                type=type,
                message=message,
                timestamp=datetime.now().isoformat(),
                data=data
            ))

    def formulate_query(self, user_query: str, attempt: int) -> Tuple[str, str]:
        self._send_message("Formulating search query...")
        result = super().formulate_query(user_query, attempt)
        self._send_message(f"Query formulated: {result[0]}, Time range: {result[1]}")
        return result

    def perform_search(self, query: str, time_range: str) -> List[Dict]:
        self._send_message("Performing search...")
        results = super().perform_search(query, time_range)
        if results:
            self._send_message(f"Found {len(results)} results")
        else:
            self._send_message("No results found", "error")
        return results

    def select_relevant_pages(self, search_results: List[Dict], user_query: str) -> List[str]:
        self._send_message("Selecting relevant pages...")
        urls = super().select_relevant_pages(search_results, user_query)
        if urls:
            self._send_message(f"Selected {len(urls)} pages")
        else:
            self._send_message("No relevant pages found", "error")
        return urls

    def scrape_content(self, urls: List[str]) -> Dict[str, str]:
        self._send_message("Scraping content...")
        content = super().scrape_content(urls)
        if content:
            self._send_message(f"Successfully scraped {len(content)} pages")
        else:
            self._send_message("Failed to scrape content", "error")
        return content

    def evaluate_scraped_content(self, user_query: str, scraped_content: Dict[str, str]) -> Tuple[str, str]:
        self._send_message("Evaluating content...")
        evaluation, decision = super().evaluate_scraped_content(user_query, scraped_content)
        self._send_message(f"Evaluation: {evaluation}\nDecision: {decision}")
        return evaluation, decision

    def generate_final_answer(self, user_query: str, scraped_content: Dict[str, str]) -> str:
        self._send_message("Generating final answer...")
        answer = super().generate_final_answer(user_query, scraped_content)
        if answer:
            self._send_message(answer, "result")
        return answer

    def search_and_improve(self, user_query: str) -> str:
        """Override to ensure all updates are sent through WebSocket"""
        self._send_message("Starting research process...")
        try:
            result = super().search_and_improve(user_query)
            if result:
                self._send_message(result, "result")
            return result
        except Exception as e:
            error_msg = f"Error during research: {str(e)}"
            self._send_message(error_msg, "error")
            raise
