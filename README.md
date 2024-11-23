# LLM Forward Proxy for Cloudflare Workers + OpenRouter

A forward proxy deployable as a Cloudlfare Worker. Meant to proxy API requests from frontends
to OpenRouter for LLM responses.

## Features

- Supports streaming and non-streaming

## Installation

Dev:

- `bun install`
- dev server: `bun run dev`
- for dev, add `OPENROUTER_API_KEY=` to `.dev.vars` in root folder

Prod:

- `bunx wrangler secret put OPENROUTER_API_KEY` to bind the OpenRouter API key to the worker
- `bunx wrangler publish`

# Request Format Type

```
type RequestBody = {
  prompt: string; // The user prompt for the model
  modelName: string; // The OpenRouter model string (e.g. "openai/gpt4o")
  stream?: boolean; // Whether to stream the response
  referer?: string; // Optional referer URL for OpenRouter identification (e.g. "https://mysite.com")
  title?: string; // Optional title header for OpenRouter identification (e.g. "My AI App")
};
```
