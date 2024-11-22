# llm_config.py

LLM_TYPE = "openai"  # Options: 'ollama', 'openai'

# LLM settings for Ollama
LLM_CONFIG_OLLAMA = {
    "llm_type": "ollama",
    "base_url": "http://localhost:11434",  # default Ollama server URL
    "model_name": "custom-phi3-32k-Q4_K_M",  # Replace with your Ollama model name
    "temperature": 0.7,
    "top_p": 0.9,
    "n_ctx": 55000,
    "context_length": 55000,
    "stop": ["User:", "\n\n"]
}

# LLM settings for OpenAI-compatible endpoint
LLM_CONFIG_OPENAI = {
    "llm_type": "openai",
    "base_url": "http://192.168.29.13:1234/v1",  # Local OpenAI-compatible endpoint
    "model_name": "local-model",  # Model name for the local endpoint
    "api_key": "not-needed",  # Can be any string for local endpoints
    "temperature": 0.7,
    "top_p": 0.9,
    "max_tokens": 1024,
    "n_ctx": 50000,
    "stop": ["User:", "\n\n"]
}

def get_llm_config():
    if LLM_TYPE == "ollama":
        return LLM_CONFIG_OLLAMA
    elif LLM_TYPE == "openai":
        return LLM_CONFIG_OPENAI
    else:
        raise ValueError(f"Invalid LLM_TYPE: {LLM_TYPE}")
