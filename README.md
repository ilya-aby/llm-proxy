# Cloudflare Worker Proxy for OpenRouter

**Problem:**

- It should be fast & easy to set up a new front-end project that can hit arbitrary LLM API endpoints without exposing API keys or requiring code changes to try new models or model providers

**Solution:**

- [OpenRouter](https://openrouter.ai/) gives us an abstraction layer to be able to use a single API key with any LLM model and to switch models with just a param instead of rewriting client code
- [Cloudflare Workers](https://workers.cloudflare.com/) give us a cheap & simple serverless forward proxy that takes requests and forwards them to OpenRouter, keeping our OpenRouter API key out of the front-end

## Features

- Supports streaming and non-streaming LLM requests
- Handles CORS preflight requests
- Handles OpenRouter API key binding

## Usage & Installation

- Create a Cloudflare account if you don't already have one
- Create an OpenRouter account if you don't already have one and create an API key for the proxy
- `bun install`
- `bunx wrangler login`

### Dev:

- dev server: `bun run dev`
- for dev, add `OPENROUTER_API_KEY=[key]` to `.dev.vars` in root folder
- sample request to check that dev is working:

```
curl -X POST \
  'http://localhost:8787' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Hello, how are you?",
    "modelName": "openai/gpt-4o-mini",
    "streaming": true
  }' | jq .
```

### Prod:

- `bunx wrangler secret put OPENROUTER_API_KEY` to bind the OpenRouter API key to the worker
- `bunx wrangler deploy`
- sample request to check that prod is working:

```
curl -X POST \
  'https://proxy-llm.abyzov.workers.dev' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Hello, how are you?",
    "modelName": "openai/gpt-4o-mini",
    "streaming": true
  }' | jq .
```

## Request Format Type

```
type RequestBody = {
  prompt: string; // The user prompt for the model
  modelName: string; // The OpenRouter model string (e.g. "openai/gpt-4o")
  stream?: boolean; // Whether to stream the response
  referer?: string; // Optional referer URL for OpenRouter identification (e.g. "https://mysite.com")
  title?: string; // Optional title header for OpenRouter identification (e.g. "My AI App")
};
```
