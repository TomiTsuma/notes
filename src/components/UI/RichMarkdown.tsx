import React, { useEffect, useId, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

let mermaidLoaderPromise: Promise<any> | null = null;

function loadMermaid(): Promise<any> {
  if (mermaidLoaderPromise) return mermaidLoaderPromise;
  const url = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaidLoaderPromise = import(/* @vite-ignore */ url)
    .then((mod) => {
      const m = mod.default || mod;
      m.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        flowchart: { htmlLabels: true, curve: 'basis' },
      });
      return m;
    })
    .catch((err) => {
      mermaidLoaderPromise = null;
      throw err;
    });
  return mermaidLoaderPromise;
}

/**
 * Sanitize common LLM Mermaid mistakes (e.g. unquoted parentheses/brackets inside node labels)
 */
function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim().replace(/^```mermaid\s*/i, '').replace(/```$/, '').trim();

  // Fix `graph TD;` or `flowchart LR;` semicolons at header
  code = code.replace(/^(flowchart|graph)\s+(TD|TB|BT|RL|LR)\s*;/im, '$1 $2\n');

  // Auto-quote unquoted square-bracket labels that contain parentheses, colons, or slashes: A[Text (info)] -> A["Text (info)"]
  code = code.replace(/([A-Za-z0-9_]+)\[(?!")([^\]]*[():,%+/\-][^\]]*)\]/g, (_m, id, label) => {
    const safeLabel = String(label).replace(/"/g, "'").trim();
    return `${id}["${safeLabel}"]`;
  });

  // Auto-quote unquoted round-bracket labels containing inner parens/colons: A(Text (info)) -> A("Text (info)")
  code = code.replace(/([A-Za-z0-9_]+)\((?![("])([^)]*[/:,%+][^\n)]*)\)/g, (_m, id, label) => {
    const safeLabel = String(label).replace(/"/g, "'").trim();
    return `${id}("${safeLabel}")`;
  });

  return code;
}

interface ParsedChartData {
  title: string;
  type: 'bar' | 'line' | 'pie';
  xAxisLabel?: string;
  yAxisLabel?: string;
  categories: string[];
  series: { name: string; values: number[]; color?: string }[];
}

const CHART_PALETTE = ['#0a7aff', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#06b6d4'];

/**
 * Parse Mermaid `xychart-beta`, `pie`, or JSON/YAML `chart` blocks into structured chart data
 */
function tryParseChartBlock(raw: string, lang: string): ParsedChartData | null {
  const trimmed = raw.trim();

  // 1. Check if JSON chart specification
  if (lang === 'chart' || lang === 'json-chart' || trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (Array.isArray(obj.labels || obj.categories) && (Array.isArray(obj.values) || Array.isArray(obj.series))) {
        const categories = (obj.labels || obj.categories).map(String);
        const series = Array.isArray(obj.series)
          ? obj.series.map((s: any, idx: number) => ({
              name: s.name || `Series ${idx + 1}`,
              values: (s.values || s.data || []).map(Number),
              color: s.color || CHART_PALETTE[idx % CHART_PALETTE.length],
            }))
          : [
              {
                name: obj.metric || obj.yAxis || 'Value',
                values: (obj.values || []).map(Number),
                color: CHART_PALETTE[0],
              },
            ];
        return {
          title: obj.title || ' Quantitative Comparison',
          type: obj.type === 'line' ? 'line' : obj.type === 'pie' ? 'pie' : 'bar',
          xAxisLabel: obj.xAxis,
          yAxisLabel: obj.yAxis,
          categories,
          series,
        };
      }
    } catch {
      // Fall through to line-based chart parser
    }
  }

  // 2. Check Mermaid `xychart-beta`
  if (/^xychart(-beta)?/i.test(trimmed)) {
    const titleMatch = trimmed.match(/title\s+"([^"]+)"/i);
    const xAxisMatch = trimmed.match(/x-axis\s+(?:"([^"]+)"\s+)?\[([^\]]+)\]/i);
    const yAxisMatch = trimmed.match(/y-axis\s+"([^"]+)"/i);
    const categories = xAxisMatch
      ? xAxisMatch[2].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
      : [];

    const series: { name: string; values: number[]; color?: string }[] = [];
    const barMatches = [...trimmed.matchAll(/\b(bar|line)\s+(?:"([^"]+)"\s+)?\[([^\]]+)\]/gi)];
    barMatches.forEach((m, idx) => {
      const values = m[3]
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((n) => !isNaN(n));
      series.push({
        name: m[2] || (m[1].toLowerCase() === 'line' ? 'Trend' : `Metric ${idx + 1}`),
        values,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
      });
    });

    if (categories.length > 0 && series.length > 0) {
      const hasLine = barMatches.some((m) => m[1].toLowerCase() === 'line') && !barMatches.some((m) => m[1].toLowerCase() === 'bar');
      return {
        title: titleMatch ? titleMatch[1] : 'Evaluation Metrics',
        type: hasLine ? 'line' : 'bar',
        xAxisLabel: xAxisMatch?.[1],
        yAxisLabel: yAxisMatch?.[1],
        categories,
        series,
      };
    }
  }

  // 3. Check Mermaid `pie`
  if (/^pie\b/i.test(trimmed)) {
    const titleMatch = trimmed.match(/title\s+([^\n]+)/i);
    const itemMatches = [...trimmed.matchAll(/"([^"]+)"\s*:\s*([0-9.]+)/g)];
    if (itemMatches.length > 0) {
      return {
        title: titleMatch ? titleMatch[1].replace(/^["']|["']$/g, '').trim() : 'Distribution',
        type: 'pie',
        categories: itemMatches.map((m) => m[1]),
        series: [
          {
            name: 'Share',
            values: itemMatches.map((m) => parseFloat(m[2])),
          },
        ],
      };
    }
  }

  // 4. Simple `chart` key: value lines
  if (lang === 'chart') {
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    let title = 'Benchmark Comparison';
    let type: 'bar' | 'line' | 'pie' = 'bar';
    const categories: string[] = [];
    const values: number[] = [];

    for (const line of lines) {
      if (/^title\s*:/i.test(line)) {
        title = line.replace(/^title\s*:\s*/i, '').trim();
        continue;
      }
      if (/^type\s*:/i.test(line)) {
        const t = line.replace(/^type\s*:\s*/i, '').trim().toLowerCase();
        if (t === 'line' || t === 'pie' || t === 'bar') type = t;
        continue;
      }
      const kv = line.match(/^([^:|]+)[:|]\s*(-?\d+(?:\.\d+)?)\s*%?$/);
      if (kv) {
        categories.push(kv[1].trim());
        values.push(parseFloat(kv[2]));
      }
    }

    if (categories.length > 0) {
      return {
        title,
        type,
        categories,
        series: [{ name: 'Score', values, color: CHART_PALETTE[0] }],
      };
    }
  }

  return null;
}

const VisualChartSVG: React.FC<{ data: ParsedChartData }> = ({ data }) => {
  const { title, type, categories, series, yAxisLabel } = data;
  const allValues = series.flatMap((s) => s.values).filter((v) => !isNaN(v));
  const maxVal = Math.max(1, ...allValues) * 1.12;
  const minVal = Math.min(0, ...allValues);

  if (type === 'pie') {
    const vals = series[0]?.values || [];
    const total = Math.max(0.0001, vals.reduce((a, b) => a + b, 0));
    let accAngle = -Math.PI / 2;

    return (
      <div
        style={{
          margin: '12px 0',
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--surface-raised, #fff)',
          border: '1px solid var(--line)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0a7aff', display: 'inline-block' }} />
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <svg width="136" height="136" viewBox="-70 -70 140 140">
            {vals.map((v, i) => {
              const sliceAngle = (v / total) * Math.PI * 2;
              const x1 = Math.cos(accAngle) * 58;
              const y1 = Math.sin(accAngle) * 58;
              const x2 = Math.cos(accAngle + sliceAngle) * 58;
              const y2 = Math.sin(accAngle + sliceAngle) * 58;
              const largeArc = sliceAngle > Math.PI ? 1 : 0;
              const pathData = `M 0 0 L ${x1} ${y1} A 58 58 0 ${largeArc} 1 ${x2} ${y2} Z`;
              accAngle += sliceAngle;
              return <path key={i} d={pathData} fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke="var(--surface-raised, #fff)" strokeWidth="2" />;
            })}
            <circle cx="0" cy="0" r="26" fill="var(--surface-raised, #fff)" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 130 }}>
            {categories.map((cat, i) => {
              const val = vals[i] || 0;
              const pct = ((val / total) * 100).toFixed(1);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: CHART_PALETTE[i % CHART_PALETTE.length], display: 'inline-block' }} />
                    {cat}
                  </span>
                  <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{pct}%</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Bar or Line SVG Chart
  const svgWidth = 360;
  const svgHeight = 200;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 42;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minVal + t * (maxVal - minVal));

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '14px 14px 10px',
        borderRadius: 10,
        background: 'var(--surface-raised, #fff)',
        border: '1px solid var(--line)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0a7aff', display: 'inline-block' }} />
          {title}
        </div>
        {yAxisLabel && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{yAxisLabel}</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible', display: 'block' }}>
        {/* Horizontal Grid Lines */}
        {yTicks.map((tv, idx) => {
          const y = padTop + plotH - ((tv - minVal) / (maxVal - minVal || 1)) * plotH;
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="var(--line)" strokeDasharray="3 3" strokeWidth="1" />
              <text x={padLeft - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)">
                {tv >= 100 ? Math.round(tv) : Number(tv.toFixed(1))}
              </text>
            </g>
          );
        })}

        {/* Bars or Lines */}
        {type === 'bar' &&
          categories.map((cat, cIdx) => {
            const groupW = plotW / Math.max(1, categories.length);
            const barW = Math.min(28, (groupW * 0.72) / Math.max(1, series.length));
            const groupStart = padLeft + cIdx * groupW + (groupW - barW * series.length) / 2;

            return (
              <g key={cIdx}>
                {series.map((s, sIdx) => {
                  const val = s.values[cIdx] ?? 0;
                  const barH = Math.max(2, ((val - minVal) / (maxVal - minVal || 1)) * plotH);
                  const x = groupStart + sIdx * barW;
                  const y = padTop + plotH - barH;
                  const fill = s.color || CHART_PALETTE[sIdx % CHART_PALETTE.length];
                  return (
                    <g key={sIdx}>
                      <rect x={x} y={y} width={Math.max(4, barW - 2)} height={barH} rx={3} fill={fill} opacity={0.9} />
                      <text
                        x={x + (barW - 2) / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="600"
                        fill="var(--ink-2)"
                        fontFamily="var(--font-mono)"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={padLeft + cIdx * groupW + groupW / 2}
                  y={padTop + plotH + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--ink-2)"
                >
                  {cat.length > 12 ? cat.slice(0, 11) + '…' : cat}
                </text>
              </g>
            );
          })}

        {type === 'line' &&
          series.map((s, sIdx) => {
            const color = s.color || CHART_PALETTE[sIdx % CHART_PALETTE.length];
            const pts = s.values.map((val, cIdx) => {
              const x = padLeft + (cIdx / Math.max(1, categories.length - 1)) * plotW;
              const y = padTop + plotH - ((val - minVal) / (maxVal - minVal || 1)) * plotH;
              return { x, y, val, cat: categories[cIdx] || String(cIdx + 1) };
            });
            const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g key={sIdx}>
                <polyline fill="none" stroke={color} strokeWidth="2.2" points={poly} />
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
                    <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="8.5" fill="var(--ink-2)" fontFamily="var(--font-mono)">
                      {p.val}
                    </text>
                    {sIdx === 0 && (
                      <text x={p.x} y={padTop + plotH + 16} textAnchor="middle" fontSize="9.5" fill="var(--ink-2)">
                        {p.cat.length > 10 ? p.cat.slice(0, 9) + '…' : p.cat}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
      </svg>

      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, justifyContent: 'center' }}>
          {series.map((s, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-2)' }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: s.color || CHART_PALETTE[idx % CHART_PALETTE.length], display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Fallback SVG flowchart renderer when Mermaid syntax has minor LLM quirks or is mid-stream
 */
const FallbackFlowchartSVG: React.FC<{ code: string }> = ({ code }) => {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, string>();
    const edgeList: { from: string; to: string; label?: string }[] = [];

    const cleanLabel = (raw: string) =>
      raw
        .replace(/^\[["']?|["']?\]$/g, '')
        .replace(/^\(["']?|["']?\)$/g, '')
        .replace(/^\{["']?|["']?\}$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();

    const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^(flowchart|graph|subgraph|end|direction|style|classDef|class|linkStyle)\b/i.test(line)) continue;

      // Match A["Label"] -->|"edge"| B["Label 2"]
      const edgeMatch = line.match(
        /([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*(?:--+>|==+>|-\.+->|--\s*[^->]+\s*--+>)\s*(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?/
      );
      if (edgeMatch) {
        const [, id1, lbl1, edgeLbl, id2, lbl2] = edgeMatch;
        if (lbl1 || !nodeMap.has(id1)) nodeMap.set(id1, lbl1 ? cleanLabel(lbl1) : nodeMap.get(id1) || id1);
        if (lbl2 || !nodeMap.has(id2)) nodeMap.set(id2, lbl2 ? cleanLabel(lbl2) : nodeMap.get(id2) || id2);
        edgeList.push({ from: id1, to: id2, label: edgeLbl?.trim() });
        continue;
      }

      const standaloneMatch = line.match(/^([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})$/);
      if (standaloneMatch) {
        nodeMap.set(standaloneMatch[1], cleanLabel(standaloneMatch[2]));
      }
    }

    return {
      nodes: Array.from(nodeMap.entries()).map(([id, label]) => ({ id, label })),
      edges: edgeList,
    };
  }, [code]);

  if (nodes.length === 0) {
    return (
      <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>
        {code}
      </pre>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 2px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {nodes.map((n, idx) => {
          const outEdge = edges.find((e) => e.from === n.id);
          return (
            <React.Fragment key={n.id}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--surface-inset)',
                  border: '1.5px solid var(--accent, #0a7aff)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  boxShadow: '0 2px 5px rgba(10,122,255,0.08)',
                }}
              >
                {n.label}
              </div>
              {idx < nodes.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-3)', fontSize: 11 }}>
                  {outEdge?.label && (
                    <span style={{ fontSize: 10, background: 'var(--surface)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--line)' }}>
                      {outEdge.label}
                    </span>
                  )}
                  <span>&rarr;</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Check if this Mermaid block is actually a chart (`xychart-beta` or `pie`)
  const parsedChart = useMemo(() => tryParseChartBlock(code, 'mermaid'), [code]);

  useEffect(() => {
    if (parsedChart) return;
    let cancelled = false;
    const sanitized = sanitizeMermaidCode(code);
    if (!sanitized || sanitized.length < 8) return;

    const timer = setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        const uniqueId = `mmd-${reactId}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(uniqueId, sanitized);
        if (!cancelled && svg) {
          setSvgHtml(svg);
          setRenderFailed(false);
        }
      } catch {
        if (!cancelled) {
          setRenderFailed(true);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, parsedChart, reactId]);

  if (parsedChart) {
    return <VisualChartSVG data={parsedChart} />;
  }

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--surface-raised, #fff)',
        border: '1px solid var(--line)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-3)' }}>
          Visual Diagram
        </span>
        {svgHtml && (
          <button
            onClick={() => setExpanded((p) => !p)}
            style={{
              border: '1px solid var(--line)',
              background: 'var(--surface-inset)',
              color: 'var(--ink-2)',
              borderRadius: 5,
              padding: '2px 7px',
              fontSize: 10.5,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Fit Panel' : 'Expand'}
          </button>
        )}
      </div>

      {svgHtml ? (
        <div
          style={{
            width: expanded ? 'max-content' : '100%',
            minWidth: expanded ? 520 : undefined,
            display: 'flex',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : renderFailed ? (
        <FallbackFlowchartSVG code={code} />
      ) : (
        <FallbackFlowchartSVG code={code} />
      )}
    </div>
  );
};

function renderMathString(latex: string, displayMode: boolean): React.ReactNode {
  try {
    const html = katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    return (
      <span
        style={displayMode ? { display: 'block', margin: '10px 0', overflowX: 'auto', textAlign: 'center' } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <code>{latex}</code>;
  }
}

export function parseInlineRich(str: string): React.ReactNode[] {
  if (!str) return [];
  // Match inline math $...$, inline code `...`, bold **...**, italic *...*, strikethrough ~~...~~, or links [text](url)
  const tokenRegex = /(\$\$[^$]+\$\$|\$[^$\n]+\$|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|(?:\b|_)\*[^*\n]+\*(?:\b|_))/g;
  const parts = str.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      return <React.Fragment key={idx}>{renderMathString(part.slice(2, -2), true)}</React.Fragment>;
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      return <React.Fragment key={idx}>{renderMathString(part.slice(1, -1), false)}</React.Fragment>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          style={{
            background: 'var(--surface-inset)',
            padding: '1.5px 5px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={idx}>{parseInlineRich(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={idx}>{part.slice(2, -2)}</del>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #0a7aff)' }}>
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

function extractStringFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractStringFromReactNode).join('');
  if (React.isValidElement(node)) {
    const props: any = node.props;
    if (props?.className === 'cl-caret') return '';
    return extractStringFromReactNode(props?.children);
  }
  return '';
}

export const RichMarkdown: React.FC<{ children: React.ReactNode; streaming?: boolean }> = ({ children, streaming }) => {
  const rawText = useMemo(() => extractStringFromReactNode(children), [children]);

  if (!rawText.trim()) {
    return typeof children === 'string' ? null : <div className="md">{children}</div>;
  }

  // Extract optional <think>...</think> reasoning block
  let thinkContent = '';
  let mainText = rawText;
  const thinkMatch = mainText.match(/^<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch && mainText.trim().startsWith('<think>')) {
    if (mainText.includes('</think>')) {
      thinkContent = thinkMatch[1].trim();
      mainText = mainText.replace(/^<think>[\s\S]*?<\/think>/i, '').trim();
    } else {
      thinkContent = thinkMatch[1].trim();
      mainText = '';
    }
  }

  const lines = mainText.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code / Mermaid / Chart Blocks: ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim().toLowerCase();
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const blockContent = blockLines.join('\n');

      if (lang === 'mermaid') {
        elements.push(<MermaidBlock key={`mmd-${i}`} code={blockContent} />);
        continue;
      }

      const chartData =
        lang === 'chart' || lang === 'json-chart' || /^xychart|^pie\b/i.test(blockContent.trim())
          ? tryParseChartBlock(blockContent, lang || 'chart')
          : null;

      if (chartData) {
        elements.push(<VisualChartSVG key={`chart-${i}`} data={chartData} />);
        continue;
      }

      elements.push(
        <pre
          key={`code-${i}`}
          style={{
            background: 'var(--surface-inset)',
            padding: '10px 12px',
            borderRadius: 8,
            overflowX: 'auto',
            fontSize: 12.5,
            fontFamily: 'var(--font-mono)',
            margin: '10px 0',
            border: '1px solid var(--line)',
          }}
        >
          <code>{blockContent}</code>
        </pre>
      );
      continue;
    }

    // 2. Display Math Block: $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        elements.push(<div key={`math-${i}`}>{renderMathString(trimmed.slice(2, -2), true)}</div>);
        i++;
        continue;
      }
      const mathLines: string[] = [trimmed.slice(2)];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i].trim().slice(0, -2));
        i++;
      }
      elements.push(<div key={`math-${i}`}>{renderMathString(mathLines.join('\n'), true)}</div>);
      continue;
    }

    // 3. Markdown Pipe Tables: | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parseRow = (r: string) =>
        r
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      if (tableLines.length >= 2) {
        const headers = parseRow(tableLines[0]);
        const isSeparator = (r: string) => /^[\s|:-]+$/.test(r);
        const bodyRows = tableLines.slice(1).filter((r) => !isSeparator(r)).map(parseRow);

        elements.push(
          <div
            key={`tbl-${i}`}
            style={{
              margin: '12px 0',
              overflowX: 'auto',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface-raised, #fff)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-inset)', borderBottom: '1px solid var(--line)' }}>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {parseInlineRich(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < bodyRows.length - 1 ? '1px solid var(--line)' : 'none',
                      background: rIdx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                    }}
                  >
                    {headers.map((_, cIdx) => (
                      <td key={cIdx} style={{ padding: '7px 10px', color: 'var(--ink-2)', verticalAlign: 'top' }}>
                        {parseInlineRich(row[cIdx] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 4. Horizontal Rule
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />);
      i++;
      continue;
    }

    // 5. Headings (# through ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const fontSizes: Record<number, number> = { 1: 18, 2: 16, 3: 14.5, 4: 13.5, 5: 13, 6: 12.5 };
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            fontSize: fontSizes[level] || 14,
            fontWeight: 700,
            color: 'var(--ink)',
            margin: level <= 2 ? '14px 0 6px' : '10px 0 4px',
            lineHeight: 1.35,
            borderBottom: level <= 2 ? '1px solid var(--line)' : 'none',
            paddingBottom: level <= 2 ? 4 : 0,
          }}
        >
          {parseInlineRich(content)}
        </div>
      );
      i++;
      continue;
    }

    // 6. Blockquotes / Callouts (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const joined = quoteLines.join('\n').replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
      elements.push(
        <blockquote
          key={`bq-${i}`}
          style={{
            borderLeft: '3px solid var(--accent, #0a7aff)',
            background: 'var(--surface-inset)',
            padding: '8px 12px',
            borderRadius: '0 8px 8px 0',
            margin: '10px 0',
            color: 'var(--ink-2)',
            fontSize: 13,
          }}
        >
          {parseInlineRich(joined)}
        </blockquote>
      );
      continue;
    }

    // 7. Unordered & Ordered Lists
    if (/^([-*+•]|\d+[.)])\s+/.test(trimmed)) {
      const isOrdered = /^\d+[.)]\s+/.test(trimmed);
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^([-*+•]|\d+[.)])\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^([-*+•]|\d+[.)])\s+/, '');
        listItems.push(
          <li key={`li-${i}`} style={{ marginBottom: 4, lineHeight: 1.55 }}>
            {parseInlineRich(itemText)}
          </li>
        );
        i++;
      }
      if (isOrdered) {
        elements.push(
          <ol key={`ol-${i}`} style={{ margin: '6px 0 10px', paddingLeft: 20 }}>
            {listItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${i}`} style={{ margin: '6px 0 10px', paddingLeft: 20 }}>
            {listItems}
          </ul>
        );
      }
      continue;
    }

    // 8. Standard Paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: '6px 0', lineHeight: 1.6 }}>
        {parseInlineRich(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div className="md">
      {thinkContent && (
        <details
          style={{
            marginBottom: 10,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'var(--surface-inset)',
            border: '1px solid var(--line)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Reasoning process</summary>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{thinkContent}</div>
        </details>
      )}
      {elements}
      {streaming && <span className="cl-caret" />}
    </div>
  );
};
