from typing import Dict, Optional, List, Any
from datetime import datetime
from queue import Queue
import json
import logging
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from Self_Improving_Search import EnhancedSelfImprovingSearch, SearchMessage
from .models import WebSocketMessage

# Configure logger
logger = logging.getLogger(__name__)

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
            "content_summaries": [],
            "analysis_steps": [],
            "source_metrics": {},
            "llm_interactions": [],  # Store LLM's thinking process
            "scraped_content": {},   # Store full content
            "knowledge_graph": {     # Store entity relationships
                "entities": [],
                "relationships": []
            }
        }

    def add_llm_interaction(self, prompt: str, response: str, stage: str) -> None:
        """Record LLM interaction for transparency"""
        self.research_details["llm_interactions"].append({
            "stage": stage,
            "prompt": prompt,
            "response": response,
            "timestamp": datetime.now().isoformat()
        })

    def add_scraped_content(self, url: str, content: str) -> None:
        """Store full scraped content"""
        self.research_details["scraped_content"][url] = {
            "content": content,
            "timestamp": datetime.now().isoformat()
        }

    def extract_entities(self, content: str) -> List[Dict]:
        """Extract entities and their types from content"""
        prompt = f"""
        Extract key entities from the following content. Identify their types and relationships.

        Content:
        {content}

        Instructions:
        1. Identify important entities (people, organizations, concepts, etc.)
        2. Determine entity types
        3. Identify relationships between entities
        4. Focus on significant connections

        Format your response as JSON:
        {{
          "entities": [
            {{"name": "entity_name", "type": "entity_type", "description": "brief_description"}},
            ...
          ],
          "relationships": [
            {{"source": "entity1", "target": "entity2", "type": "relationship_type"}},
            ...
          ]
        }}
        """

        try:
            response = self.llm.generate(prompt, max_tokens=1000)
            data = json.loads(response)
            return data
        except Exception as e:
            logger.error(f"Error extracting entities: {str(e)}")
            return {"entities": [], "relationships": []}

    def update_knowledge_graph(self, content: str) -> None:
        """Update knowledge graph with new content"""
        graph_data = self.extract_entities(content)
        
        # Add new entities
        existing_entities = {e["name"] for e in self.research_details["knowledge_graph"]["entities"]}
        new_entities = [e for e in graph_data["entities"] if e["name"] not in existing_entities]
        self.research_details["knowledge_graph"]["entities"].extend(new_entities)

        # Add new relationships
        self.research_details["knowledge_graph"]["relationships"].extend(graph_data["relationships"])

    def send_progress_update(self, stage: str, message: str, data: Optional[Dict] = None, outcome: Optional[str] = None) -> None:
        """Send a progress update through the WebSocket"""
        if self.session_id not in self.message_queues:
            return

        # Add analysis step if outcome is provided
        if outcome or stage != "thinking":  # Record all steps except generic thinking
            self.research_details["analysis_steps"].append({
                "stage": stage,
                "description": message,
                "outcome": outcome or "In progress",
                "timestamp": datetime.now().isoformat()
            })

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
                    "content_summaries": self.research_details["content_summaries"],
                    "analysis_steps": self.research_details["analysis_steps"],
                    "source_metrics": self.research_details["source_metrics"],
                    "llm_interactions": self.research_details["llm_interactions"],
                    "scraped_content": self.research_details["scraped_content"],
                    "knowledge_graph": self.research_details["knowledge_graph"]
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
            url = message.message.replace("Successfully scraped:", "").strip()
            self.sources_analyzed += 1
            self.research_details["urls_accessed"].add(url)
            self.research_details["successful_urls"].add(url)
            
            # Calculate source reliability based on content quality
            content = message.data.get("content", "") if message.data else ""
            content_length = len(content)
            has_citations = "http" in content.lower() or "www." in content.lower()
            well_formatted = content.count('\n') > 5  # Basic structure check
            
            # Simple reliability score (can be enhanced)
            reliability = min(100, (
                50 +  # Base score
                (20 if content_length > 1000 else 10) +  # Length bonus
                (20 if has_citations else 0) +  # Citations bonus
                (10 if well_formatted else 0)  # Format bonus
            ))

            self.research_details["source_metrics"][url] = {
                "reliability": reliability,
                "content_length": content_length,
                "scrape_time": datetime.now().isoformat()
            }

            if message.data and "content" in message.data:
                self.research_details["content_summaries"].append({
                    "url": url,
                    "summary": message.data["content"][:200] + "...",
                    "reliability": reliability
                })
            
            self.send_progress_update(
                "analyzing",
                message.message,
                outcome=f"Successfully retrieved and analyzed content from {url} (Reliability: {reliability}%)"
            )

        elif "Failed to scrape:" in message.message or "Robots.txt disallows scraping of" in message.message:
            url = message.message.split()[-1].strip()
            self.research_details["urls_accessed"].add(url)
            self.research_details["failed_urls"].add(url)
            self.send_progress_update(
                "scraping",
                "Continuing with available sources...",
                outcome=f"Failed to retrieve content from {url}"
            )

        elif "Search attempt" in message.message:
            self.send_progress_update(
                "searching",
                message.message,
                outcome="Initiated new search iteration"
            )

        elif "Formulated query:" in message.message:
            query = message.message.replace("Formulated query:", "").strip()
            self.current_focus = {
                "area": query,
                "priority": 1
            }
            self.send_progress_update(
                "querying",
                message.message,
                outcome=f"Generated search query: {query}"
            )

        elif "Thinking" in message.message:
            self.send_progress_update(
                "thinking",
                message.message,
                outcome="Processing gathered information"
            )

        elif "Evaluating content" in message.message:
            self.send_progress_update(
                "evaluating",
                message.message,
                outcome="Assessing information quality and relevance"
            )

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
                        "content_summaries": self.research_details["content_summaries"],
                        "analysis_steps": self.research_details["analysis_steps"],
                        "source_metrics": self.research_details["source_metrics"],
                        "llm_interactions": self.research_details["llm_interactions"],
                        "scraped_content": self.research_details["scraped_content"],
                        "knowledge_graph": self.research_details["knowledge_graph"]
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

    def extract_key_findings(self, content: str) -> List[str]:
        """Extract key findings with improved analysis"""
        prompt = f"""
        Analyze the following research content and extract key findings. Focus on the most important discoveries, facts, or conclusions.

        Content:
        {content}

        Instructions:
        1. Identify 3-5 main findings or conclusions
        2. Each finding should be a complete, standalone statement
        3. Focus on factual information and significant insights
        4. Avoid repetition and general statements
        5. Do not include phrases like "the research shows" or "according to"
        6. Prioritize specific, concrete information over general statements
        7. Include quantitative data when available
        8. Highlight unique or unexpected discoveries

        Format your response as a list of findings, one per line, starting with a dash (-).
        For each finding, include a confidence score (0-100) in parentheses.
        """

        try:
            response = self.llm.generate(prompt, max_tokens=500)
            findings = []
            for line in response.split('\n'):
                if line.strip().startswith('-'):
                    # Extract finding and confidence score
                    finding = line.strip('- ').strip()
                    confidence = 100  # Default confidence
                    if '(' in finding and finding.endswith(')'):
                        try:
                            confidence = int(finding.split('(')[-1].strip(')'))
                            finding = finding.split('(')[0].strip()
                        except ValueError:
                            pass
                    findings.append({
                        "finding": finding,
                        "confidence": confidence
                    })
            return findings[:5]  # Return up to 5 findings
        except Exception as e:
            logger.error(f"Error extracting key findings: {str(e)}")
            return []

    def update_current_focus(self, focus: str, priority: int = 1) -> None:
        """Update the current research focus"""
        self.message_handler.current_focus = {
            "area": focus,
            "priority": priority
        }
        self.message_handler.send_progress_update(
            "focusing",
            f"Current focus: {focus}",
            outcome=f"Investigating area with priority {priority}"
        )

    def perform_single_search(self, query: str) -> Optional[str]:
        """Perform a single search with progress updates"""
        try:
            message_queue = self.message_queues.get(self.session_id)
            if not message_queue:
                return None

            # Update status for query formulation
            self.message_handler.send_progress_update(
                "formulating",
                "Formulating search query...",
                {"query": query}
            )

            # Use parent class's methods for actual search
            formulated_query, time_range = self.formulate_query(query, 0)
            self.update_current_focus(formulated_query)
            
            # Update status for search
            self.message_handler.send_progress_update(
                "searching",
                f"Searching with query: {formulated_query}",
                {"query": formulated_query}
            )

            if self.stop_requested:
                return None

            results = self.perform_search(formulated_query, time_range)
            if not results:
                message_queue.put({
                    "type": "result",
                    "message": "No results found.",
                    "data": {
                        "result": "No results found.",
                        "research_details": self.message_handler.research_details
                    },
                    "timestamp": datetime.now().isoformat()
                })
                return "No results found."

            # Update status for page selection
            self.message_handler.send_progress_update(
                "selecting",
                "Selecting relevant pages...",
                {"results_count": len(results)}
            )

            if self.stop_requested:
                return None

            selected_urls = self.select_relevant_pages(results, query)
            if not selected_urls:
                message_queue.put({
                    "type": "result",
                    "message": "No relevant pages found.",
                    "data": {
                        "result": "No relevant pages found.",
                        "research_details": self.message_handler.research_details
                    },
                    "timestamp": datetime.now().isoformat()
                })
                return "No relevant pages found."

            # Update status for content scraping
            self.message_handler.send_progress_update(
                "scraping",
                "Retrieving content from selected pages...",
                {"urls_count": len(selected_urls)}
            )

            if self.stop_requested:
                return None

            scraped_content = self.scrape_content(selected_urls)
            if not scraped_content:
                message_queue.put({
                    "type": "result",
                    "message": "Failed to retrieve content.",
                    "data": {
                        "result": "Failed to retrieve content.",
                        "research_details": self.message_handler.research_details
                    },
                    "timestamp": datetime.now().isoformat()
                })
                return "Failed to retrieve content."

            # Store full content and update knowledge graph
            for url, content in scraped_content.items():
                self.message_handler.add_scraped_content(url, content)
                self.message_handler.update_knowledge_graph(content)

            # Generate answer with thinking process
            prompt = f"""
            Analyze the following content to answer the query: "{query}"
            
            Content:
            {self.format_scraped_content(scraped_content)}
            
            Think through this step by step:
            1. What are the key pieces of information?
            2. How do they relate to the query?
            3. What conclusions can we draw?
            4. What are the limitations or uncertainties?
            
            Then provide a comprehensive answer.
            """
            
            # Record LLM interaction
            response = self.llm.generate(prompt, max_tokens=1000)
            self.message_handler.add_llm_interaction(prompt, response, "answer_generation")

            # Extract findings
            findings = self.extract_key_findings("\n".join(scraped_content.values()))

            # Format final answer
            final_answer = self.format_final_answer(response, findings)

            # Send final result with all details
            message_queue.put({
                "type": "result",
                "message": final_answer,
                "data": {
                    "result": final_answer,
                    "sources_analyzed": self.message_handler.sources_analyzed,
                    "current_focus": self.message_handler.current_focus,
                    "research_details": {
                        "urls_accessed": list(self.message_handler.research_details["urls_accessed"]),
                        "successful_urls": list(self.message_handler.research_details["successful_urls"]),
                        "failed_urls": list(self.message_handler.research_details["failed_urls"]),
                        "content_summaries": self.message_handler.research_details["content_summaries"],
                        "analysis_steps": self.message_handler.research_details["analysis_steps"],
                        "source_metrics": self.message_handler.research_details["source_metrics"],
                        "llm_interactions": self.message_handler.research_details["llm_interactions"],
                        "scraped_content": self.message_handler.research_details["scraped_content"],
                        "knowledge_graph": self.message_handler.research_details["knowledge_graph"]
                    },
                    "findings": findings
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

            return final_answer

        except Exception as e:
            logger.error(f"Error in single search: {str(e)}")
            if message_queue:
                message_queue.put({
                    "type": "error",
                    "message": f"Search error: {str(e)}",
                    "data": {"research_details": self.message_handler.research_details},
                    "timestamp": datetime.now().isoformat()
                })
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

            if self.stop_requested:
                result = "Research process was stopped by user request."

            # Send final result with all research details
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
                            "content_summaries": self.message_handler.research_details["content_summaries"],
                            "analysis_steps": self.message_handler.research_details["analysis_steps"],
                            "source_metrics": self.message_handler.research_details["source_metrics"],
                            "llm_interactions": self.message_handler.research_details["llm_interactions"],
                            "scraped_content": self.message_handler.research_details["scraped_content"],
                            "knowledge_graph": self.message_handler.research_details["knowledge_graph"]
                        }
                    },
                    "timestamp": datetime.now().isoformat()
                })

            # Update final status
            message_queue.put({
                "type": "status",
                "data": {
                    "status": "completed" if not self.stop_requested else "stopped",
                    "sources_analyzed": self.message_handler.sources_analyzed,
                    "current_focus": self.message_handler.current_focus,
                    "research_details": self.message_handler.research_details
                },
                "timestamp": datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"Error in search_and_improve: {str(e)}")
            if message_queue:
                message_queue.put({
                    "type": "error",
                    "message": f"Search error: {str(e)}",
                    "data": {"research_details": self.message_handler.research_details},
                    "timestamp": datetime.now().isoformat()
                })

    def format_final_answer(self, response: str, findings: List[Dict]) -> str:
        """Format the final answer with findings and insights"""
        try:
            # Start with the main response
            formatted_answer = response.strip()

            # Add key findings if available
            if findings:
                formatted_answer += "\n\nKey Findings:\n"
                for finding in findings:
                    confidence = finding.get('confidence', 100)
                    formatted_answer += f"• {finding['finding']} (Confidence: {confidence}%)\n"

            return formatted_answer

        except Exception as e:
            logger.error(f"Error formatting final answer: {str(e)}")
            return response  # Return original response if formatting fails


