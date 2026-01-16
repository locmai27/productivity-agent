### To run frontend
npm install
then cd into frontend/Productivity-Agent
npm run dev 
thas all







# Productivity Agent / Automated Todo List

A LangGraph-based productivity agent with Amazon Bedrock LLM integration.

## Project Structure

```
.
├── src/
│   ├── workflow.py      # LangGraph workflow definition
│   └── llm_client.py    # Amazon Bedrock LLM client
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure AWS credentials for Bedrock access:
```bash
aws configure
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

## Usage

### Workflow

The LangGraph workflow is defined in `src/workflow.py`. Currently, it's an empty template that you can extend with your productivity agent logic.

### LLM Client

The Bedrock client in `src/llm_client.py` provides an interface for interacting with Amazon Bedrock models. The implementation is a template that needs to be completed with actual Bedrock API calls.

Example usage (once implemented):
```python
from src.llm_client import create_bedrock_client

client = create_bedrock_client(
    region_name="us-east-1",
    model_id="anthropic.claude-3-sonnet-20240229-v1:0"
)

response = client.invoke("Your prompt here")
```

## Next Steps

1. Implement the Bedrock client methods in `src/llm_client.py`
2. Define workflow nodes and edges in `src/workflow.py`
3. Add state management for todos and productivity tracking
4. Integrate the LLM client with the workflow

## Notes

- The Bedrock client uses boto3 for AWS integration
- The workflow uses LangGraph's StateGraph for state management
- Both modules are currently templates and need implementation

