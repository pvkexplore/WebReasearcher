from typing import Dict, List, Optional, Tuple
from datetime import datetime
import asyncio
import json
import queue
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor

from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from Self_Improving_Search import EnhancedSelfImprovingSearch, SearchMessage, MessageHandler
from .models import SearchSettings

class AsyncMessageHandler(MessageHandler):
    """Handler that forwards messages to WebSocket clients"""
    def __init__(self, session_id: str, message_queues: Dict[str, queue.Queue], message_processing_tasks: Dict[str, bool]):
        self.session_id = session_id
        self._message_queue = queue.Queue(maxsize=1000)
        self._stop_event = threading.Event()
        self._last_message = None
        self.message_queues = message_queues
        self.message_processing_tasks = message_processing_tasks
        
        message_queues[session_id] = self._message_queue
        message_processing_tasks[session_id] = False
        print(f"Created message queue for session {session_id}")

    def handle_message(self, message: SearchMessage) -> None:
        """Queue message for sending"""
        if not self._stop_event.is_set():
            try:
                if message.message:
                    message.message = message.message.strip()
                if not message.message:
                    return

                if (self._last_message and 
                    message.type == self._last_message.type and 
                    message.message == self._last_message.message):
                    return

                self._last_message = message

                try:
                    print(f"Queueing message: {message.type} - {message.message[:100]}")
                    self._message_queue.put_nowait(message)
                except queue.Full:
                    print(f"Message queue full, dropping message: {message}")

            except Exception as e:
                print(f"Error handling message: {e}")
                traceback.print_exc()

    def stop(self):
        """Stop message processing"""
        self._stop_event.set()
        if self.session_id in self.message_processing_tasks:
            self.message_processing_tasks[self.session_id] = False

class AsyncSearchEngine(EnhancedSelfImprovingSearch):
    """Search engine that sends updates through WebSocket"""
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, session_id: str, 
                 message_queues: Dict[str, queue.Queue], message_processing_tasks: Dict[str, bool],
                 settings: Optional[SearchSettings] = None):
        self.session_id = session_id
        self.message_handler = AsyncMessageHandler(session_id, message_queues, message_processing_tasks)
        self._stop_event = threading.Event()
        max_attempts = settings.maxAttempts if settings else 5
        super().__init__(llm, parser, message_handler=self.message_handler, max_attempts=max_attempts)
        self.settings = settings or SearchSettings()
        self.last_query = ""
        self.last_time_range = ""
        self.searched_urls = set()  # Track searched URLs

    def should_stop(self) -> bool:
        """Check if search should stop"""
        return self._stop_event.is_set()

    def stop(self):
        """Stop the search process"""
        self._stop_event.set()
        if self.message_handler:
            self.message_handler.stop()

    def send_message(self, type: str, message: str, data: Optional[Dict] = None) -> None:
        """Send message through handler"""
        if self.message_handler and not self.should_stop():
            message = message.strip() if message else ""
            if message:
                self.message_handler.handle_message(SearchMessage(
                    type=type,
                    message=message,
                    timestamp=datetime.now().isoformat(),
                    data=data
                ))

    # Override base class methods with status updates
    def formulate_query(self, user_query: str, attempt: int) -> Tuple[str, str]:
        self.send_message("info", f"Formulating query (attempt {attempt + 1})...")
        try:
            query, time_range = super().formulate_query(user_query, attempt)
            self.send_message("info", f"Formulated query: {query}")
            self.send_message("info", f"Time range: {time_range}")
            return query, time_range
        except Exception as e:
            self.send_message("error", f"Error formulating query: {str(e)}")
            raise

    def perform_search(self, query: str, time_range: str) -> List[Dict]:
        self.last_query = query
        self.last_time_range = time_range
        self.send_message("info", f"Searching with query: {query}")
        try:
            results = super().perform_search(query, time_range)
            self.send_message("info", f"Found {len(results)} results")
            return results
        except Exception as e:
            self.send_message("error", f"Search error: {str(e)}")
            raise

    def select_relevant_pages(self, search_results: List[Dict], user_query: str) -> List[str]:
        self.send_message("info", "Selecting relevant pages...")
        try:
            urls = super().select_relevant_pages(search_results, user_query)
            self.send_message("info", f"Selected {len(urls)} pages")
            return urls
        except Exception as e:
            self.send_message("error", f"Error selecting pages: {str(e)}")
            raise

    def scrape_content(self, urls: List[str]) -> Dict[str, str]:
        self.send_message("info", f"Scraping {len(urls)} pages...")
        try:
            content = super().scrape_content(urls)
            # Track searched URLs
            self.searched_urls.update(urls)
            self.send_message("info", f"Successfully scraped {len(content)} pages")
            return content
        except Exception as e:
            self.send_message("error", f"Error scraping content: {str(e)}")
            raise

    def evaluate_scraped_content(self, user_query: str, scraped_content: Dict[str, str]) -> Tuple[str, str]:
        self.send_message("info", "Evaluating content...")
        try:
            evaluation, decision = super().evaluate_scraped_content(user_query, scraped_content)
            self.send_message("info", f"Evaluation: {evaluation}")
            self.send_message("info", f"Decision: {decision}")
            return evaluation, decision
        except Exception as e:
            self.send_message("error", f"Error evaluating content: {str(e)}")
            raise

    def generate_final_answer(self, user_query: str, scraped_content: Dict[str, str]) -> str:
        self.send_message("info", "Generating final answer...")
        try:
            answer = super().generate_final_answer(user_query, scraped_content)
            self.send_message("result", answer)
            return answer
        except Exception as e:
            self.send_message("error", f"Error generating answer: {str(e)}")
            raise

    def synthesize_final_answer(self, user_query: str) -> str:
        self.send_message("info", "Synthesizing final answer...")
        try:
            answer = super().synthesize_final_answer(user_query)
            self.send_message("result", answer)
            return answer
        except Exception as e:
            self.send_message("error", f"Error synthesizing answer: {str(e)}")
            raise

    def search_and_improve(self, user_query: str) -> str:
        """Main search loop with status updates and stopping"""
        self.send_message("status", "Starting research process...")
        try:
            attempt = 0
            while attempt < self.max_attempts and not self.should_stop():
                try:
                    self.send_message("info", f"\nSearch attempt {attempt + 1}:")
                    
                    if self.should_stop():
                        self.send_message("info", "Search stopped by user")
                        return "Search stopped by user"

                    formulated_query, time_range = self.formulate_query(user_query, attempt)
                    if self.should_stop():
                        return "Search stopped by user"

                    search_results = self.perform_search(formulated_query, time_range)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not search_results:
                        self.send_message("info", "No results found, retrying...")
                        attempt += 1
                        continue

                    selected_urls = self.select_relevant_pages(search_results, user_query)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not selected_urls:
                        self.send_message("info", "No relevant URLs found, retrying...")
                        attempt += 1
                        continue

                    scraped_content = self.scrape_content(selected_urls)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not scraped_content:
                        self.send_message("info", "Failed to scrape content, retrying...")
                        attempt += 1
                        continue

                    evaluation, decision = self.evaluate_scraped_content(user_query, scraped_content)
                    if self.should_stop():
                        return "Search stopped by user"

                    if decision == "answer":
                        result = self.generate_final_answer(user_query, scraped_content)
                        return result
                    
                    self.send_message("info", "Need more information, refining search...")
                    attempt += 1

                except Exception as e:
                    self.send_message("error", f"Error during search: {str(e)}")
                    attempt += 1

            if self.should_stop():
                return "Search stopped by user"

            result = self.synthesize_final_answer(user_query)
            return result

        except Exception as e:
            self.send_message("error", f"Error during research: {str(e)}")
            raise
        finally:
            if self.should_stop():
                self.send_message("status", "Search stopped")
            else:
                self.send_message("status", "Search completed")
