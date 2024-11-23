import requests
import json
import time
from llm_config import get_llm_config

class LLMWrapper:
    def __init__(self):
        self.llm_config = get_llm_config()
        self.llm_type = self.llm_config.get('llm_type', 'openai')
        if self.llm_type == 'ollama':
            self.base_url = self.llm_config.get('base_url', 'http://localhost:11434')
            self.model_name = self.llm_config.get('model_name', 'your_model_name')
        elif self.llm_type == 'openai':
            self.base_url = self.llm_config.get('base_url').rstrip('/')
            self.model_name = self.llm_config.get('model_name')
            self.api_key = self.llm_config.get('api_key')
            self._validate_openai_config()
        else:
            raise ValueError(f"Unsupported LLM type: {self.llm_type}")

    def _validate_openai_config(self):
        """Validate OpenAI configuration and test connection"""
        if not self.base_url:
            raise ValueError("OpenAI base_url is required")
        if not self.model_name:
            raise ValueError("OpenAI model_name is required")
        
        # Test connection
        try:
            response = requests.get(f"{self.base_url}/models", 
                                 headers=self._get_headers(),
                                 timeout=5)
            if response.status_code != 200:
                raise ValueError(f"Failed to connect to OpenAI endpoint: {response.text}")
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Failed to connect to OpenAI endpoint: {str(e)}")

    def _get_headers(self):
        """Get headers for OpenAI requests"""
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key.lower() != "not-needed":
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def generate(self, prompt, **kwargs):
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                if self.llm_type == 'ollama':
                    return self._ollama_generate(prompt, **kwargs)
                elif self.llm_type == 'openai':
                    return self._openai_generate(prompt, **kwargs)
                else:
                    raise ValueError(f"Unsupported LLM type: {self.llm_type}")
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(retry_delay * (attempt + 1))

    def _openai_generate(self, prompt, **kwargs):
        url = f"{self.base_url}/chat/completions"
        
        # Handle max_tokens parameter
        max_tokens = kwargs.get('max_tokens', self.llm_config.get('max_tokens', 1024))
        #if max_tokens > 4096:  # OpenAI typical limit
        #    max_tokens = 4096

        data = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}]
            #,
            #"temperature": kwargs.get('temperature', self.llm_config.get('temperature', 0.8)),
            #"top_p": kwargs.get('top_p', self.llm_config.get('top_p', 0.95)),
            #"max_tokens": max_tokens,
            #"stop": kwargs.get('stop', self.llm_config.get('stop', []))
        }
        
        print(data,'--->')
        
        try:
            response = requests.post(
                url, 
                headers=self._get_headers(),
                json=data,
                timeout=30
            )
            
            if response.status_code == 429:
                raise Exception("Rate limit exceeded. Please try again later.")
            elif response.status_code == 413:
                raise Exception("Input too long. Try reducing the prompt size.")
            elif response.status_code != 200:
                raise Exception(f"OpenAI API request failed with status {response.status_code}: {response.text}")
            
            response_data = response.json()
            if not response_data.get('choices'):
                raise Exception("No response choices returned from API")
            
            print(response_data)    
            
            return response_data['choices'][0]['message']['content'].strip()
            
        except requests.exceptions.Timeout:
            raise Exception("Request timed out. The server took too long to respond.")
        except requests.exceptions.RequestException as e:
            raise Exception(f"OpenAI API request failed: {str(e)}")

    def _ollama_generate(self, prompt, **kwargs):
        url = f"{self.base_url}/api/generate"
        data = {
            'model': self.model_name,
            'prompt': prompt,
            'options': {
                'temperature': kwargs.get('temperature', self.llm_config.get('temperature', 0.7)),
                'top_p': kwargs.get('top_p', self.llm_config.get('top_p', 0.9)),
                'stop': kwargs.get('stop', self.llm_config.get('stop', [])),
                'num_predict': kwargs.get('max_tokens', self.llm_config.get('max_tokens', 55000)),
                'num_ctx': self.llm_config.get('n_ctx', 55000)
            }
        }
        response = requests.post(url, json=data, stream=True)
        if response.status_code != 200:
            raise Exception(f"Ollama API request failed with status {response.status_code}: {response.text}")
        text = ''.join(json.loads(line)['response'] for line in response.iter_lines() if line)
        return text.strip()

    def _cleanup(self):
        """Force terminate any running LLM processes"""
        if self.llm_type == 'ollama':
            try:
                requests.post(f"{self.base_url}/api/terminate")
            except:
                pass

            try:
                import subprocess
                subprocess.run(['pkill', '-f', 'ollama'], capture_output=True)
            except:
                pass
