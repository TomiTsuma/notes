export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || '/api/ollama';
export const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3.5:researcher';

const VISUAL_CAPABILITIES_HINT = `
You are Chlio AI, an academic research assistant. Answer the user's question directly, accurately, and independently.
Determine the structure, depth, and organization of your response yourself based on what best suits the user's specific question.
When helpful for explaining concepts, architectures, workflows, or quantitative data, prefer visual explanations interwoven into your answer using:
- Markdown headings, bold emphasis, lists, and blockquotes
- Mermaid diagrams (\`\`\`mermaid with flowchart LR/TD or sequenceDiagram; quote node labels that contain parentheses or special characters, e.g. A["Encoder (GNN)"])
- Markdown tables for comparisons, metrics, or ablations
- Inline charts (\`\`\`chart with JSON: {"title":"...","type":"bar","labels":["A","B"],"values":[80,92],"yAxis":"Score"})
- LaTeX math ($...$ inline and $$...$$ block)
`.trim();

function formatStreamedOutput(thinkingText: string, responseText: string): string {
  const cleanThinking = thinkingText.trim();
  if (cleanThinking && responseText) {
    return `<think>\n${cleanThinking}\n</think>\n\n${responseText}`;
  }
  if (cleanThinking && !responseText) {
    return `<think>\n${cleanThinking}\n</think>`;
  }
  return responseText;
}

async function consumeOllamaNdjsonStream(
  response: Response,
  onChunk: (fullText: string) => void
): Promise<string> {
  const body: any = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const rawText = await response.text();
    let thinkingText = '';
    let responseText = '';
    for (const line of rawText.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (typeof parsed.thinking === 'string') thinkingText += parsed.thinking;
        if (typeof parsed.response === 'string') responseText += parsed.response;
      } catch {
        // ignore non-JSON line
      }
    }
    const combined = formatStreamedOutput(thinkingText, responseText);
    if (combined) onChunk(combined);
    return combined;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let thinkingText = '';
  let responseText = '';

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    if (!result.value) continue;

    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        let updated = false;
        if (typeof parsed.thinking === 'string' && parsed.thinking.length > 0) {
          thinkingText += parsed.thinking;
          updated = true;
        }
        if (typeof parsed.response === 'string' && parsed.response.length > 0) {
          responseText += parsed.response;
          updated = true;
        }
        if (updated) {
          onChunk(formatStreamedOutput(thinkingText, responseText));
        }
      } catch (err: any) {
        if (err?.message && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      if (typeof parsed.thinking === 'string') thinkingText += parsed.thinking;
      if (typeof parsed.response === 'string') responseText += parsed.response;
    } catch {
      // ignore trailing partial JSON
    }
  }

  const finalOutput = formatStreamedOutput(thinkingText, responseText);
  if (finalOutput) {
    onChunk(finalOutput);
  }
  return finalOutput;
}

export async function generateOllamaNoteStream(
  prompt: string,
  contextText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const fullPrompt = `${VISUAL_CAPABILITIES_HINT}

<DocumentContext>
${contextText.slice(0, 45000)}
</DocumentContext>

<Topic>
${prompt}
</Topic>

Provide a clear, insightful explanation of "${prompt}" grounded in the document context above:`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: true,
      options: {
        num_ctx: 16384,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unable to read error body');
    throw new Error(`Ollama request failed (${response.status} ${response.statusText}): ${body}`);
  }

  const result = await consumeOllamaNdjsonStream(response, onChunk);
  if (!result.trim()) {
    throw new Error('Ollama returned an empty response.');
  }
  return result;
}

export async function generateOllamaChatStream(
  question: string | { role: 'user' | 'assistant'; content: string }[],
  paperText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  // Always extract the current user question so each question is answered independently
  const currentQuestion =
    typeof question === 'string'
      ? question
      : [...question].reverse().find((m) => m.role === 'user')?.content ||
        question[question.length - 1]?.content ||
        '';

  const paperContextBlock = paperText.trim()
    ? `<DocumentContext>\n${paperText.slice(0, 45000)}\n</DocumentContext>\n\n`
    : '';

  const fullPrompt = `${VISUAL_CAPABILITIES_HINT}

${paperContextBlock}User Question:
${currentQuestion}`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: true,
      options: {
        num_ctx: 16384,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Ollama Error (${response.status} ${response.statusText})${errBody ? `: ${errBody}` : ''}`);
  }

  const result = await consumeOllamaNdjsonStream(response, onChunk);
  if (!result.trim()) {
    throw new Error('Ollama returned an empty response.');
  }
  return result;
}
