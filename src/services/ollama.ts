export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || '/api/ollama';
export const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3.5:researcher';

const VISUAL_EXPLANATION_GUIDELINES = `
CRITICAL VISUAL & FORMATTING INSTRUCTIONS:
1. NEVER produce long unbroken blocks of text. Break explanations into crisp sections using Markdown headings (## and ###), bullet points with **bold** lead-ins, and blockquote callouts (> **Key Insight:** ...).
2. INTERLEAVE VISUALS DIRECTLY INSIDE YOUR EXPLANATION (do NOT group visuals only at the end):
   - **Model Architecture & Flow Diagrams**: Embed \`\`\`mermaid diagrams (\`flowchart LR\`, \`flowchart TD\`, or \`sequenceDiagram\`) right inside the methodology/architecture explanation to illustrate pipelines, layers, and data flow. Always wrap node labels in double quotes if they contain parentheses or special characters, e.g. \`A["Input Graph G=(V,E)"] --> B["VQ Encoder"]\`.
   - **Embedded Quantitative Charts**: When discussing performance, benchmarks, speedups, or ablations, embed a \`\`\`chart block with JSON right after introducing the results, for example:
\`\`\`chart
{"title": "Benchmark Performance Comparison", "type": "bar", "labels": ["Baseline", "Diffusion", "Proposed Model"], "values": [78.4, 88.1, 94.6], "yAxis": "Score (%)"}
\`\`\`
   - **Evaluation & Hyperparameter Tables**: Present experimental metrics, dataset statistics, and ablations using Markdown pipe tables (\`| Model | Metric | Result | Key Takeaway |\`) inline within the discussion.
   - **Equations**: Use LaTeX math (\`$...$\` inline and \`$$...$$\` block) for loss functions and formulations.
`.trim();

export async function generateOllamaNoteStream(
  prompt: string,
  contextText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const fullPrompt = `You are Clio AI, an expert visual academic research assistant. Extract and explain the requested topic from the provided Document Context using a visual-first approach (interleaving Mermaid diagrams, inline charts, and Markdown tables within concise explanations).

${VISUAL_EXPLANATION_GUIDELINES}

<Topic>
${prompt}
</Topic>

<DocumentContext>
${contextText.slice(0, 50000)}
</DocumentContext>

Generate a highly specific, visually rich technical breakdown strictly grounded in the document context. Interleave at least one Mermaid diagram (\`\`\`mermaid), a Markdown comparison/details table, and an inline chart (\`\`\`chart) where relevant inside your explanation:`;

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
        num_ctx: 16384,
      },
    }),
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
        } catch {
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
          } catch {
            // ignore partial chunk
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
      } catch {
        // ignore
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

  if (streamResult !== null && streamResult.trim().length > 0) {
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
    } catch {
      // ignore non-JSON lines
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
  paperText: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const historyPrompt = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const paperContextBlock = paperText.trim()
    ? `<PaperContentsFormatTxt>\n${paperText.slice(0, 45000)}\n</PaperContentsFormatTxt>`
    : `<PaperContentsFormatTxt>\nNo paper document context loaded.\n</PaperContentsFormatTxt>`;

  const fullPrompt = `System: You are Clio AI, an expert visual-first academic research assistant embedded in Clio Notes.
You MUST answer questions accurately and directly based on the provided paper contents, while preferring to explain concepts visually rather than producing long walls of plain text.

${VISUAL_EXPLANATION_GUIDELINES}

When summarizing a paper or explaining its methodology/results:
1. Start with a concise executive overview & core contribution callout.
2. Immediately embed a \`\`\`mermaid diagram showing the conceptual workflow or model architecture right inside the architecture section.
3. Explain the mathematical or algorithmic mechanism concisely, followed by an inline Markdown table and/or \`\`\`chart block illustrating evaluation details, benchmarks, or trade-offs within the evaluation section.

${paperContextBlock}

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
      stream: true,
    }),
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
      } catch {
        // ignore partial line
      }
    }
  }

  if (text.trim()) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.response) {
        fullResponse += parsed.response;
        onChunk(fullResponse);
      }
    } catch {
      // ignore
    }
  }

  if (!fullResponse.trim()) {
    throw new Error('Empty response from Ollama');
  }

  return fullResponse;
}
