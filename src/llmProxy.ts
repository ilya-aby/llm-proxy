type Env = {
  OPENROUTER_API_KEY: string;
};

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type RequestBody = {
  messages: Message[]; // Array of messages in the conversation
  modelName: string; // The OpenRouter model string (e.g. "openai/gpt4o")
  stream?: boolean; // Whether to stream the response
  referer?: string; // Optional referer URL for OpenRouter identification
  title?: string; // Optional title header for OpenRouter identification
};

// Referrer and title are optionally used by OpenRouter to identify the client
// Change default referrer to your Cloudflare worker URL
const DEFAULT_REFERRER = 'https://llmproxy.cloudwise.workers.dev/';
const DEFAULT_TITLE = 'LLM Proxy Worker';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Define common headers
    const corsHeaders: HeadersInit = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
    };

    // Utility function for generating responses
    const createResponse = (
      body: string | null,
      status = 200,
      contentType = 'application/json'
    ) => {
      console.log(
        `Response: status=${status}, contentType=${contentType}, body=${body?.slice(0, 100)}${
          body && body.length > 100 ? '...' : ''
        }`
      );
      return new Response(body, {
        status,
        headers: {
          'Content-Type': contentType,
          ...corsHeaders,
        },
      });
    };

    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return createResponse(null, 204); // 204 No Content for OPTIONS
    }

    if (request.method !== 'POST') {
      return createResponse(JSON.stringify({ error: 'Only POST requests are allowed' }), 405);
    }

    const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return createResponse(JSON.stringify({ error: 'Server error: missing API key' }), 500);
    }

    let requestBody: RequestBody;
    try {
      requestBody = await request.json();
      const lastMessage = requestBody.messages[requestBody.messages.length - 1];
      console.log(
        `Request: modelName=${requestBody.modelName}, stream=${requestBody.stream}, messageCount=${
          requestBody.messages.length
        }, lastMessage="${lastMessage.content.slice(0, 20)}..."`
      );
    } catch (error) {
      return createResponse(JSON.stringify({ error: 'Invalid JSON in request body' }), 400);
    }

    const { messages, modelName, stream = false, referer, title } = requestBody;
    if (!modelName || !messages || messages.length === 0) {
      return createResponse(
        JSON.stringify({
          error: 'Missing required fields. Need "modelName" and at least one message',
        }),
        400
      );
    }

    // Validate message format
    const isValidMessage = (msg: Message) =>
      ['system', 'user', 'assistant'].includes(msg.role) && typeof msg.content === 'string';

    if (!messages.every(isValidMessage)) {
      return createResponse(
        JSON.stringify({
          error: 'Invalid message format. Each message must have a valid role and content',
        }),
        400
      );
    }

    const apiPayload = {
      messages,
      model: modelName,
      stream,
    };

    try {
      const openRouterResponse: Response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer || DEFAULT_REFERRER,
          'X-Title': title || DEFAULT_TITLE,
        },
        body: JSON.stringify(apiPayload),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        console.error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
        return createResponse(
          JSON.stringify({ error: `Error from OpenRouter: ${errorText}` }),
          openRouterResponse.status
        );
      }

      if (stream) {
        // Handle streaming response
        console.log(`Starting streaming response for model: ${modelName}`);
        const { readable, writable } = new TransformStream();
        openRouterResponse.body?.pipeTo(writable);

        return new Response(readable, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders,
          },
        });
      } else {
        // Handle non-streaming response
        const openRouterData = await openRouterResponse.json();
        console.log(`Completed non-streaming request for model: ${modelName}`);
        return createResponse(JSON.stringify(openRouterData));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : 'An unknown error occurred';
      console.error(`Proxy error: ${errorMessage}`);
      return createResponse(
        JSON.stringify({ error: `Error proxying to OpenRouter: ${errorMessage}` }),
        500
      );
    }
  },
};
