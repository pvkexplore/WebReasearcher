from typing import Dict, Optional, List, Any, Tuple
from datetime import datetime
from queue import Queue
import json
import logging
import re
from duckduckgo_search import DDGS
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from web_scraper import get_web_content, can_fetch

# Configure logger
logger = logging.getLogger(__name__)

class WebSocketMessageHandler:
    def __init__(self, session_id: str, message_queues: Dict[str, Queue], llm: Optional[LLMWrapper] = None):
        self.session_id = session_id
        self.message_queues = message_queues
        self.llm = llm  # Store LLM instance
        self.sources_analyzed = 0
        self.current_focus = None
        self.research_details = {
            "urls_accessed": set(),
            "successful_urls": set(),
            "failed_urls": set(),
            "content_summaries": [],
            "analysis_steps": [],
            "source_metrics": {},
            "llm_interactions": [],
            "scraped_content": {},
            "knowledge_graph": {
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
        if not self.llm:
            logger.error("LLM not available for entity extraction")
            return {"entities": [], "relationships": []}

        prompt = f"""
        Extract key entities and their relationships from this content. Focus on creating a meaningful knowledge graph.

        Content:
        {content}

        Instructions:
        1. Entity Identification:
           - People (experts, authors, historical figures)
           - Organizations (companies, institutions, groups)
           - Concepts (theories, methods, technologies)
           - Places (locations, regions, facilities)
           - Events (occurrences, developments, milestones)
           - Products (tools, systems, applications)

        2. Entity Properties:
           - Type: Specific category (person, org, concept, etc.)
           - Description: Key characteristics or relevance
           - Role: Function or significance in the context

        3. Relationship Types:
           - Hierarchical (part-of, belongs-to)
           - Temporal (precedes, follows)
           - Causal (causes, affects)
           - Associative (related-to, similar-to)
           - Action (performs, creates)
           - Dependency (requires, depends-on)

        4. Focus on:
           - Main entities central to the topic
           - Important connections between entities
           - Clear, descriptive relationship types
           - Contextually relevant information

        Format your response as JSON:
        {{
          "entities": [
            {{
              "name": "entity_name",
              "type": "entity_type",
              "description": "brief_description"
            }},
            ...
          ],
          "relationships": [
            {{
              "source": "source_entity_name",
              "target": "target_entity_name",
              "type": "relationship_type"
            }},
            ...
          ]
        }}

        Ensure:
        - Entity names are consistent when referenced
        - Relationships connect existing entities
        - Descriptions are concise but informative
        - Types are specific and accurate
        """

        try:
            response = self.llm.generate(prompt, max_tokens=1000)
            self.add_llm_interaction(prompt, response, "entity_extraction")
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

class AsyncSearchEngine:
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, session_id: str,
                 message_queues: Dict[str, Queue], message_processing_tasks: Dict[str, bool],
                 settings: Dict[str, Any]):
        self.llm = llm
        self.parser = parser
        self.session_id = session_id
        self.message_queues = message_queues
        self.message_processing_tasks = message_processing_tasks
        self.settings = settings
        # Pass LLM to message handler
        self.message_handler = WebSocketMessageHandler(session_id, message_queues, llm)
        self.stop_requested = False
        self.max_attempts = settings.get('maxAttempts', 5)
        self.current_focus = None
        self.searched_urls = set()

    def formulate_query(self, user_query: str, attempt: int) -> Tuple[str, str]:
        """Generate an effective search query with attempt-based refinement"""
        prompt = f"""
You are creating a search query for a search engine to answer the following user question :
"{user_query[:200]}"

Your task:
1. Create a search query of upto 10 words that will yield relevant results.
2. This is your search attempt #{attempt + 1}. Try your approach based on attempt number:
   - Attempt 1: Use primary keywords
   - Attempt 2: Include synonyms or related terms
   - Attempt 3: Focus on specific aspects
   - Attempt 4: Consider alternative phrasings
   - Attempt 5: Broaden the scope
3. Determine if a specific time range is needed.
Time range options:
- 'd': Past day (for very recent events)
- 'w': Past week (for recent developments)
- 'm': Past month (for ongoing topics)
- 'y': Past year (for annual context)
- 'none': No time limit (for general knowledge)

Response format:
Search query: [upto 10 word query]
Time range: [d/w/m/y/none]
"""
        # Record LLM interaction
        response = self.llm.generate(prompt, max_tokens=50)
        self.message_handler.add_llm_interaction(prompt, response, "query_formulation")

        # Parse response
        query = ""
        time_range = "none"
        for line in response.strip().split('\n'):
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip()
                if "query" in key:
                    query = self._clean_query(value)
                elif "time" in key or "range" in key:
                    time_range = self._validate_time_range(value)

        if not query:
            query = " ".join(user_query.split()[:5])

        # Update current focus for API compatibility
        self.current_focus = {
            "area": query,
            "priority": 1
        }
        self.message_handler.current_focus = self.current_focus

        return query, time_range

    def _clean_query(self, query: str) -> str:
        """Clean and normalize search query"""
        query = re.sub(r'["\'\[\]]', '', query)
        query = re.sub(r'\s+', ' ', query)
        return query.strip()[:100]

    def _validate_time_range(self, time_range: str) -> str:
        """Validate time range value"""
        valid_ranges = ['d', 'w', 'm', 'y', 'none']
        time_range = time_range.lower()
        return time_range if time_range in valid_ranges else 'none'

    def perform_search(self, query: str, time_range: str) -> List[Dict]:
        """Execute search query"""
        if not query:
            return []

        with DDGS() as ddgs:
            try:
                if time_range and time_range != 'none':
                    results = list(ddgs.text(query, timelimit=time_range, max_results=10))
                else:
                    results = list(ddgs.text(query, max_results=10))
                return [{'number': i+1, **result} for i, result in enumerate(results)]
            except Exception as e:
                logger.error(f"Search error: {str(e)}")
                return []

    def select_relevant_pages(self, search_results: List[Dict], user_query: str) -> List[str]:
        """Select most relevant pages to analyze"""
        prompt = f"""
        Given User question : "{user_query[:200]}"
        Given list of Web search results: {list(self.searched_urls)}

Instructions:
1. Select exactly 2 results that:
   - Are most relevant to the query
   - Come from reliable sources
2. Prioritize:
   - Official documentation/sources
   - Recent information if topic is time-sensitive
   - Comprehensive overviews
   - Primary sources over secondary ones

Respond in the Format:
Selected Results: [Two numbers]
Reasoning: [Your reasoning]
"""
        # Record LLM interaction
        response = self.llm.generate(prompt, max_tokens=200)
        self.message_handler.add_llm_interaction(prompt, response, "page_selection")

        # Parse response
        selected_nums = []
        for line in response.strip().split('\n'):
            if line.startswith('Selected Results:'):
                selected_nums = [int(num.strip()) for num in re.findall(r'\d+', line)]
                break

        if len(selected_nums) == 2:
            selected_urls = [result['href'] for result in search_results 
                           if result['number'] in selected_nums]
            return [url for url in selected_urls if can_fetch(url)]

        # Fallback to top results
        return [result['href'] for result in search_results[:2] 
                if can_fetch(result['href'])]

    def _format_results(self, results: List[Dict]) -> str:
        """Format search results for LLM"""
        formatted = []
        for result in results:
            formatted.append(
                f"{result['number']}. Title: {result.get('title', 'N/A')}\n"
                f"   Snippet: {result.get('body', 'N/A')[:200]}...\n"
                f"   URL: {result.get('href', 'N/A')}\n"
            )
        return "\n".join(formatted)

    def scrape_content(self, urls: List[str]) -> Dict[str, str]:
        """Scrape and process content from URLs"""
        scraped_content = {}
        for url in urls:
            if can_fetch(url):
                content = get_web_content([url])
                if content:
                    scraped_content.update(content)
                    
                    # Store content and update knowledge graph
                    for page_url, page_content in content.items():
                        self.message_handler.add_scraped_content(page_url, page_content)
                        
                        # Update knowledge graph for research mode
                        if self.settings.get("searchMode") == "research":
                            self.message_handler.update_knowledge_graph(page_content)
                    
                    # Update metrics
                    content_length = len(content[url])
                    has_citations = "http" in content[url].lower()
                    well_formatted = content[url].count('\n') > 5
                    
                    reliability = min(100, (
                        50 +  # Base score
                        (20 if content_length > 1000 else 10) +  # Length bonus
                        (20 if has_citations else 0) +  # Citations bonus
                        (10 if well_formatted else 0)  # Format bonus
                    ))
                    
                    self.message_handler.research_details["source_metrics"][url] = {
                        "reliability": reliability,
                        "content_length": content_length,
                        "scrape_time": datetime.now().isoformat()
                    }
                    
                    self.message_handler.research_details["urls_accessed"].add(url)
                    self.message_handler.research_details["successful_urls"].add(url)
                    self.message_handler.sources_analyzed += 1
                    self.searched_urls.add(url)

        return scraped_content

    def evaluate_content(self, user_query: str, scraped_content: Dict[str, str]) -> Tuple[str, str]:
        """Evaluate if content is sufficient with refinement guidance"""
        # Remove knowledge graph update from here since it's now in scrape_content
        prompt = f"""
Act as a decision making analyst following instructions. Does the the given content substantiate responding to question: "{user_query[:200]}"

Given new Content:
{self._format_content(scraped_content)}

Given previous Content:
{self._summarize_previous_findings()}

Instructions for your decision making:
1. Compare new content with previous findings
2. Identify:
   - What new information was discovered
   - What gaps still remain
   - What contradictions need resolution
   - What aspects need verification

Determine if:
A) Content is sufficient to respons to the question when:
   - Core question is answered
   - Key claims are verified
   - Confidence is high

B) Need refinement ('refine') when:
   - Important gaps remain
   - Claims need verification
   - Contradictions exist
   - Confidence is low

Response Format:
Decision: [answer/refine]
Evaluation: [Detailed evaluation of content quality and relevance]
NextSteps: [specific aspects to target next to improve the search quality]
"""
        # Record LLM interaction
        response = self.llm.generate(prompt, max_tokens=200)
        self.message_handler.add_llm_interaction(prompt, response, "content_evaluation")

        # Parse response
        evaluation = ""
        decision = "refine"
        for line in response.strip().split('\n'):
            if line.startswith('Evaluation:'):
                evaluation = line.split(':', 1)[1].strip()
            elif line.startswith('Decision:'):
                decision = line.split(':', 1)[1].strip().lower()

        return evaluation, decision

    def generate_answer(self, user_query: str, scraped_content: Dict[str, str]) -> str:
        """Generate final answer with comprehensive synthesis"""
        prompt = f"""
Answer this question using the provided content:
"{user_query[:200]}"

Content:
{self._format_content(scraped_content)}

Synthesis Instructions:
1. Information Integration:
   - Combine insights from all sources
   - Cross-reference key points
   - Resolve any contradictions
   - Note source agreement/disagreement

2. Confidence Assessment:
   For each key point, indicate:
   - Confidence level (High/Medium/Low)
   - Number of sources confirming
   - Quality of supporting evidence
   - Any contradicting information

3. Answer Structure:
   - Start with strongest, verified claims
   - Build supporting details
   - Address uncertainties
   - Note limitations

4. Quality Checks:
   - Verify claims against sources
   - Check for logical consistency
   - Maintain accuracy

5. Clarity:
   - Use clear, precise language
   - Organize logically
   - Highlight key insights
   - Note confidence levels

Answer:
[
Answer in clear bullet points. with each bullet not morethan 5 lines. 
]
"""
        # Record LLM interaction
        response = self.llm.generate(prompt, max_tokens=10000)
        self.message_handler.add_llm_interaction(prompt, response, "answer_generation")

        return response.strip()

    def _format_content(self, content: Dict[str, str]) -> str:
        """Format content for LLM"""
        formatted = []
        for url, text in content.items():
            text = re.sub(r'\s+', ' ', text)
            formatted.append(f"Content from {url}:\n{text}\n")
        return "\n".join(formatted)

    def search_and_improve(self, query: str) -> None:
        """Main research function with proper status updates"""
        attempt = 0
        best_content = {}  # Track best content across attempts
        best_confidence = 0  # Track confidence in best content
        
        while attempt < self.max_attempts and not self.stop_requested:
            try:
                self.message_handler.send_progress_update(
                    "search_start",
                    f"Starting search attempt {attempt + 1} of {self.max_attempts}",
                    outcome=f"Initializing attempt {attempt + 1}"
                )

                # Formulate query
                self.message_handler.send_progress_update(
                    "query_formulation",
                    f"Formulating search query for attempt {attempt + 1}",
                    outcome="Analyzing query requirements"
                )
                search_query, time_range = self.formulate_query(query, attempt)
                if not search_query:
                    attempt += 1
                    continue

                # Perform search
                self.message_handler.send_progress_update(
                    "web_search",
                    f"Executing web search with query: {search_query}",
                    outcome="Retrieving search results"
                )
                results = self.perform_search(search_query, time_range)
                if not results:
                    attempt += 1
                    continue

                # Select pages
                self.message_handler.send_progress_update(
                    "page_selection",
                    "Analyzing search results for relevance",
                    outcome="Selecting most relevant pages"
                )
                selected_urls = self.select_relevant_pages(results, query)
                if not selected_urls:
                    attempt += 1
                    continue

                # Scrape content
                self.message_handler.send_progress_update(
                    "content_scraping",
                    "Retrieving content from selected sources",
                    outcome="Extracting detailed information"
                )
                scraped_content = self.scrape_content(selected_urls)
                if not scraped_content:
                    attempt += 1
                    continue

                # Calculate current content confidence
                self.message_handler.send_progress_update(
                    "content_analysis",
                    "Analyzing content quality and relevance",
                    outcome="Evaluating information quality"
                )
                current_confidence = self._calculate_content_confidence(scraped_content)
                
                # Update best content if this attempt is better
                if current_confidence > best_confidence:
                    best_content = scraped_content
                    best_confidence = current_confidence

                # Evaluate content
                self.message_handler.send_progress_update(
                    "content_evaluation",
                    "Evaluating content completeness",
                    outcome="Determining if more research is needed"
                )
                evaluation, decision = self.evaluate_content(query, scraped_content)
                
                if decision == "answer" or attempt == self.max_attempts - 1:
                    # Generate answer
                    self.message_handler.send_progress_update(
                        "answer_generation",
                        "Synthesizing final answer",
                        outcome="Compiling research findings"
                    )
                    answer = self.generate_answer(query, best_content)
                    
                    # Send final result
                    queue = self.message_queues.get(self.session_id)
                    if queue:
                        # Send result first
                        queue.put({
                            "type": "result",
                            "message": answer,
                            "data": {
                                "result": answer,
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
                                "confidence": best_confidence
                            },
                            "timestamp": datetime.now().isoformat()
                        })
                        
                        # Then send completed status
                        queue.put({
                            "type": "status",
                            "message": "Research completed",
                            "data": {
                                "status": "completed",
                                "result": answer,
                                "confidence": best_confidence
                            },
                            "timestamp": datetime.now().isoformat()
                        })
                    return
                
                attempt += 1

            except Exception as e:
                logger.error(f"Error in search attempt: {str(e)}")
                attempt += 1

        # If we reach here, use best content found
        if best_content:
            answer = self.generate_answer(query, best_content)
        else:
            answer = "Based on the available information, I cannot provide a complete answer. Please try rephrasing your query."

        # Send final result
        queue = self.message_queues.get(self.session_id)
        if queue:
            queue.put({
                "type": "result",
                "message": answer,
                "data": {
                    "result": answer,
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
                    "confidence": best_confidence
                },
                "timestamp": datetime.now().isoformat()
            })
            
            # Send completed status
            queue.put({
                "type": "status",
                "message": "Research completed",
                "data": {
                    "status": "completed",
                    "result": answer,
                    "confidence": best_confidence
                },
                "timestamp": datetime.now().isoformat()
            })

    def _calculate_content_confidence(self, content: Dict[str, str]) -> int:
        """Calculate confidence score for content"""
        if not content:
            return 0
            
        total_score = 0
        for url in content.keys():
            if url in self.message_handler.research_details["source_metrics"]:
                total_score += self.message_handler.research_details["source_metrics"][url]["reliability"]
                
        # Average reliability, scaled to 0-100
        return min(100, total_score // len(content)) if content else 0

    def stop(self) -> None:
        """Stop the research process"""
        self.stop_requested = True
        
        # Send stopped status
        queue = self.message_queues.get(self.session_id)
        if queue:
            queue.put({
                "type": "status",
                "message": "Research stopped",
                "data": {
                    "status": "stopped"
                },
                "timestamp": datetime.now().isoformat()
            })

    def _summarize_previous_findings(self) -> str:
        """Summarize insights from previous search attempts"""
        findings = []
        
        # Add successful URLs and their reliability
        for url in self.message_handler.research_details["successful_urls"]:
            if url in self.message_handler.research_details["source_metrics"]:
                reliability = self.message_handler.research_details["source_metrics"][url]["reliability"]
                findings.append(f"Source ({reliability}% reliable): {url}")

        # Add content summaries
        for summary in self.message_handler.research_details["content_summaries"]:
            findings.append(f"Finding: {summary}")

        return "\n".join(findings) if findings else "No previous findings"
