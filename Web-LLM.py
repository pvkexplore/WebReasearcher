import sys
import os
from colorama import init, Fore, Style
import logging
import time
from io import StringIO
from Self_Improving_Search import EnhancedSelfImprovingSearch
from llm_config import get_llm_config
from llm_response_parser import UltimateLLMResponseParser
from llm_wrapper import LLMWrapper
from strategic_analysis_parser import StrategicAnalysisParser
from research_manager import ResearchManager

# Initialize colorama
if os.name == 'nt':  # Windows-specific initialization
    init(convert=True, strip=False, wrap=True)
else:
    init()

# Set up logging
log_directory = 'logs'
if not os.path.exists(log_directory):
    os.makedirs(log_directory)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
log_file = os.path.join(log_directory, 'web_llm.log')
file_handler = logging.FileHandler(log_file)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.handlers = []
logger.addHandler(file_handler)
logger.propagate = False

# Disable other loggers
for name in logging.root.manager.loggerDict:
    if name != __name__:
        logging.getLogger(name).disabled = True

class OutputRedirector:
    def __init__(self, stream=None):
        self.stream = stream or StringIO()
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr

    def __enter__(self):
        sys.stdout = self.stream
        sys.stderr = self.stream
        return self.stream

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr

def print_header():
    print(Fore.CYAN + Style.BRIGHT + """
    ╔══════════════════════════════════════════════════════════╗
    ║             🌐 Advanced Research Assistant 🤖             ║
    ╚══════════════════════════════════════════════════════════╝
    """ + Style.RESET_ALL)
    print(Fore.YELLOW + """
    Welcome to the Advanced Research Assistant!

    Usage:
    - Start your research query with '@'
      Example: "@analyze the impact of AI on healthcare"

    Press CTRL+D (Linux/Mac) or CTRL+Z (Windows) to submit input.
    """ + Style.RESET_ALL)

def initialize_system():
    """Initialize system with proper error checking"""
    try:
        print(Fore.YELLOW + "Initializing system..." + Style.RESET_ALL)

        llm_config = get_llm_config()
        
        # Validate based on LLM type
        if llm_config['llm_type'] == 'ollama':
            import requests
            try:
                response = requests.get(llm_config['base_url'], timeout=5)
                if response.status_code != 200:
                    raise ConnectionError("Cannot connect to Ollama server")
            except requests.exceptions.RequestException:
                raise ConnectionError(
                    "\nCannot connect to Ollama server!"
                    "\nPlease ensure:"
                    "\n1. Ollama is installed"
                    "\n2. Ollama server is running (try 'ollama serve')"
                    "\n3. The model specified in llm_config.py is pulled"
                )
        elif llm_config['llm_type'] == 'openai':
            import requests
            try:
                base_url = llm_config.get('base_url', '').rstrip('/')
                headers = {"Content-Type": "application/json"}
                if llm_config.get('api_key') and llm_config['api_key'].lower() != "not-needed":
                    headers["Authorization"] = f"Bearer {llm_config['api_key']}"
                response = requests.get(f"{base_url}/models", headers=headers, timeout=5)
                if response.status_code != 200:
                    raise ConnectionError(f"Cannot connect to OpenAI endpoint: {response.text}")
            except requests.exceptions.RequestException as e:
                raise ConnectionError(
                    f"\nCannot connect to OpenAI endpoint!"
                    f"\nPlease ensure:"
                    f"\n1. The endpoint URL is correct: {base_url}"
                    f"\n2. The server is running and accessible"
                    f"\n3. API key configuration is correct (if required)"
                    f"\nError: {str(e)}"
                )

        with OutputRedirector() as output:
            llm_wrapper = LLMWrapper()
            try:
                test_response = llm_wrapper.generate("Test", max_tokens=10)
                if not test_response:
                    raise ConnectionError("LLM failed to generate response")
            except Exception as e:
                raise ConnectionError(f"LLM test failed: {str(e)}")

            parser = UltimateLLMResponseParser()
            search_engine = EnhancedSelfImprovingSearch(llm_wrapper, parser)
            research_manager = ResearchManager(llm_wrapper, parser, search_engine)

        print(Fore.GREEN + "System initialized successfully." + Style.RESET_ALL)
        return llm_wrapper, parser, search_engine, research_manager
    except Exception as e:
        logger.error(f"Error initializing system: {str(e)}", exc_info=True)
        print(Fore.RED + f"System initialization failed: {str(e)}" + Style.RESET_ALL)
        return None, None, None, None

def handle_search_mode(search_engine, query):
    """Handles search mode operations"""
    print(f"{Fore.CYAN}Searching: {query}{Style.RESET_ALL}")
    try:
        result = search_engine.search_and_improve(query)
        if result:
            print(f"\n{Fore.GREEN}Search Result:{Style.RESET_ALL}")
            print(result)
        else:
            print(f"{Fore.RED}No satisfactory results found.{Style.RESET_ALL}")
    except Exception as e:
        print(f"{Fore.RED}Search error: {str(e)}{Style.RESET_ALL}")

def handle_research_mode(research_manager, query):
    """Handles research mode operations"""
    print(f"{Fore.CYAN}Initiating research mode...{Style.RESET_ALL}")

    try:
        # Start the research
        research_manager.start_research(query)

        submit_key = "CTRL+Z" if os.name == 'nt' else "CTRL+D"
        print(f"\n{Fore.YELLOW}Research Running. Available Commands:{Style.RESET_ALL}")
        print(f"Type command and press {submit_key}:")
        print("'s' = Show status")
        print("'f' = Show focus")
        print("'q' = Quit research")

        while research_manager.is_active():
            try:
                command = get_multiline_input().strip().lower()
                if command == 's':
                    print("\n" + research_manager.get_progress())
                elif command == 'f':
                    if research_manager.current_focus:
                        print(f"\n{Fore.CYAN}Current Focus:{Style.RESET_ALL}")
                        print(f"Area: {research_manager.current_focus.area}")
                        print(f"Priority: {research_manager.current_focus.priority}")
                    else:
                        print(f"\n{Fore.YELLOW}No current focus area{Style.RESET_ALL}")
                elif command == 'q':
                    break
            except KeyboardInterrupt:
                break

        # Get final summary first
        summary = research_manager.terminate_research()

        # Ensure research UI is fully cleaned up
        research_manager._cleanup_research_ui()

        # Now in main terminal, show summary
        print(f"\n{Fore.GREEN}Research Summary:{Style.RESET_ALL}")
        print(summary)

        # Only NOW start conversation mode if we have a valid summary
        if research_manager.research_complete and research_manager.research_summary:
            time.sleep(0.5)  # Small delay to ensure clean transition
            research_manager.start_conversation_mode()

        return

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Research interrupted.{Style.RESET_ALL}")
        research_manager.terminate_research()
    except Exception as e:
        print(f"\n{Fore.RED}Research error: {str(e)}{Style.RESET_ALL}")
        research_manager.terminate_research()

def get_multiline_input() -> str:
    """Get multiline input with cross-platform support"""
    print(f"{Fore.GREEN}📝 Enter your message (Press CTRL+D/CTRL+Z to submit):{Style.RESET_ALL}")
    lines = []
    
    if os.name == 'nt':  # Windows
        import msvcrt
        current_line = []
        while True:
            if msvcrt.kbhit():
                char = msvcrt.getwch()
                
                # CTRL+Z
                if char == '\x1a':
                    print()  # New line for clean display
                    if current_line:
                        lines.append(''.join(current_line))
                    return ' '.join(lines).strip()
                
                # Enter
                elif char == '\r':
                    print()  # New line
                    if current_line:  # Only add non-empty lines
                        lines.append(''.join(current_line))
                    current_line = []
                    if not current_line:  # Empty line (just Enter pressed)
                        break
                
                # Backspace
                elif char == '\x08':
                    if current_line:
                        current_line.pop()
                        print('\b \b', end='', flush=True)
                
                # CTRL+C
                elif char == '\x03':
                    print("\nOperation cancelled")
                    sys.exit(0)
                
                # Normal character
                elif 32 <= ord(char) <= 126:
                    current_line.append(char)
                    print(char, end='', flush=True)
    else:  # Unix-like systems
        try:
            while True:
                line = input()
                if line:  # Only add non-empty lines
                    lines.append(line)
                if not line:  # Empty line (just Enter pressed)
                    break
        except EOFError:  # Ctrl+D pressed
            pass
        except KeyboardInterrupt:  # Ctrl+C pressed
            print("\nOperation cancelled")
            sys.exit(0)

    return ' '.join(lines).strip()

def main():
    print_header()
    try:
        llm, parser, search_engine, research_manager = initialize_system()
        if not all([llm, parser, search_engine, research_manager]):
            return

        while True:
            try:
                # Get input with improved CTRL+D handling
                user_input = get_multiline_input()

                # Handle immediate CTRL+D (empty input)
                if user_input == "":
                    user_input = "@quit"  # Convert empty CTRL+D to quit command

                user_input = user_input.strip()

                # Check for special quit markers
                if user_input in ["@quit", "quit", "q"]:
                    print(Fore.YELLOW + "\nGoodbye!" + Style.RESET_ALL)
                    break

                if not user_input:
                    continue

                if user_input.lower() == 'help':
                    print_header()
                    continue

                if user_input.startswith('/'):
                    search_query = user_input[1:].strip()
                    handle_search_mode(search_engine, search_query)

                elif user_input.startswith('@'):
                    research_query = user_input[1:].strip()
                    handle_research_mode(research_manager, research_query)

                else:
                    print(f"{Fore.RED}Please start with '/' for search or '@' for research.{Style.RESET_ALL}")

            except KeyboardInterrupt:
                print(f"\n{Fore.YELLOW}Exiting program...{Style.RESET_ALL}")
                break

            except Exception as e:
                logger.error(f"Error in main loop: {str(e)}")
                print(f"{Fore.RED}An error occurred: {str(e)}{Style.RESET_ALL}")
                continue

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Program terminated by user.{Style.RESET_ALL}")

    except Exception as e:
        logger.critical(f"Critical error: {str(e)}")
        print(f"{Fore.RED}Critical error: {str(e)}{Style.RESET_ALL}")

    finally:
        # Ensure proper cleanup on exit
        try:
            if 'research_manager' in locals() and research_manager:
                if hasattr(research_manager, 'ui'):
                    research_manager.ui.cleanup()
            curses.endwin()
        except:
            pass
        os._exit(0)

if __name__ == "__main__":
    main()
