export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || '/api/ollama';
export const OLLAMA_MODEL = 'qwen3.5:35b-tuned';

export async function generateOllamaNoteStream(
  prompt: string,
  contextText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const fullPrompt = `You are an expert academic research assistant mapping documents precisely. Extract and summarize the strict details requested logically from the provided Document context.

<Topic>
${prompt}
</Topic>

<DocumentContext>
${contextText.slice(0, 50000)}
</DocumentContext>

Generate a highly specific, densely informative technical summary strictly answering the requested topic structure! Keep information organized. Focus solely on details found entirely inside the document!`;

  const isSafari = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  };

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: !isSafari(),
      options: {
        num_ctx: 16384 // Enforce sufficient context bounds dynamically
      }
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unable to read error body');
    throw new Error(`Failed to map AI pipeline: ${response.status} ${response.statusText} - ${body}`);
  }

  const supportsReadableStream = (body: any): body is ReadableStream => {
    return !!body && typeof body.getReader === 'function';
  };

  const readStream = async () => {
    if (isSafari()) {
      return null;
    }

    const body: any = response.body;
    if (!supportsReadableStream(body)) return null;

    const reader = body.getReader();
    if (!reader || typeof reader.read !== 'function') return null;

    const decoder = new TextDecoder('utf-8');
    let text = '';
    let fullResponse = '';

    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        if (!result.value) continue;

        let chunk = '';
        try {
          chunk = decoder.decode(result.value, { stream: true });
        } catch (decodeError) {
          chunk = decoder.decode(result.value);
        }

        text += chunk;
        const lines = text.split('\n');
        text = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
              onChunk(fullResponse);
            }
          } catch (e) {
            // ignore malformed partial chunks until complete
          }
        }
      }
    } catch (streamError) {
      console.warn('Stream read failed, falling back to text response:', streamError);
      return null;
    }

    if (text.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.response) {
          fullResponse += parsed.response;
          onChunk(fullResponse);
        }
      } catch (e) {
        // if final chunk isn't JSON, ignore it
      }
    }

    return fullResponse;
  };

  let streamResult: string | null;
  try {
    streamResult = await readStream();
  } catch (err) {
    console.warn('Stream helper failed, using fallback text response:', err);
    streamResult = null;
  }

  if (streamResult !== null) {
    return streamResult;
  }

  const fallbackText = await response.text();
  let fallbackResponse = '';
  for (const line of fallbackText.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.response) {
        fallbackResponse += parsed.response;
      }
    } catch (e) {
      // ignore non-JSON lines in fallback
    }
  }

  if (!fallbackResponse) {
    throw new Error('No readable stream returned by backend and fallback response was empty');
  }

  onChunk(fallbackResponse);
  return fallbackResponse;
}

export async function generateOllamaChatStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  contextText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const historyPrompt = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

  const fullPrompt = `You are a helpful, brilliant AI coding and research assistant integrated into the TomiTsuma Notes workspace. Help the user with their queries. You can reference details from the document context if relevant.

<DocumentContext>
${contextText.slice(0, 30000)}
</DocumentContext>

<ConversationHistory>
${historyPrompt}
</ConversationHistory>

Assistant:`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama Chat Error: ${response.status} ${response.statusText}`);
  }

  const body: any = response.body;
  if (!body) throw new Error('No stream response body');

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let text = '';
  let fullResponse = '';

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    if (!result.value) continue;

    const chunk = decoder.decode(result.value, { stream: true });
    text += chunk;
    const lines = text.split('\n');
    text = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          fullResponse += parsed.response;
          onChunk(fullResponse);
        }
      } catch (e) {}
    }
  }

  return fullResponse;
}

