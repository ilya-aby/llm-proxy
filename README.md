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

```bash
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

```bash
curl -X POST \
  'https://llmproxy.[your-server-name].workers.dev' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Hello, how are you?",
    "modelName": "openai/gpt-4o-mini",
    "streaming": true
  }' | jq .
```

## Request Format Type

```typescript
type RequestBody = {
  prompt: string; // User prompt for the model
  modelName: string; // OpenRouter model string (e.g. "openai/gpt-4o")
  stream?: boolean; // Whether to stream the response
  referer?: string; // Optional referer URL for OpenRouter identification (e.g. "https://mysite.com")
  title?: string; // Optional title header for OpenRouter identification (e.g. "My AI App")
};
```

## Client Code Examples

### Non-Streaming Request

```typescript
async function queryLLM(prompt: string, modelName: string) {
  const response = await fetch('https://llmproxy.your-server.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      modelName,
      streaming: false,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Streaming Request

```typescript
async function streamLLM(prompt: string, modelName: string, onChunk: (text: string) => void) {
  const response = await fetch('https://llmproxy.your-server.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      modelName,
      streaming: true,
    }),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reader available');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonString = line.slice(6);
        if (jsonString === '[DONE]') break;

        try {
          const data = JSON.parse(jsonString);
          const content = data.choices[0].delta.content;
          if (content) onChunk(content);
        } catch (e) {
          console.error('Error parsing JSON:', e);
        }
      }
    }
  }
}

// Usage example:
streamLLM('Tell me a story', 'openai/gpt-4', (chunk) => {
  console.log(chunk); // or append to UI
});
```
