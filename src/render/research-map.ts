import path from 'node:path';
import type { EvolutionState } from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function summarizeEvolutionBoundaries(state: EvolutionState): {
  total: number;
  open: number;
  resolved: number;
  active: string[];
} {
  const summary = {
    total: state.boundaries.length,
    open: 0,
    resolved: 0,
    active: [] as string[],
  };

  for (const boundary of state.boundaries) {
    if (boundary.state === 'open') {
      summary.open += 1;
      summary.active.push(boundary.id);
    } else {
      summary.resolved += 1;
    }
  }

  return summary;
}

export async function renderResearchMapHtmlFromState(
  projectRoot: string,
  state: EvolutionState,
  outputPath: string
): Promise<string> {
  const summary = summarizeEvolutionBoundaries(state);
  const relativeOutputPath = path.isAbsolute(outputPath) ? path.relative(projectRoot, outputPath).split(path.sep).join('/') : outputPath;
  const absoluteOutputPath = path.join(projectRoot, relativeOutputPath);

  const studyRows = state.studies
    .map(
      (study) => `
        <tr>
          <td>${escapeHtml(study.id)}</td>
          <td>${escapeHtml(study.kind)}</td>
          <td>${escapeHtml(study.question)}</td>
          <td>${escapeHtml(study.resolves.join(', ') || '-')}</td>
          <td>${escapeHtml(study.opens.join(', ') || '-')}</td>
          <td>${escapeHtml(study.candidates.join(' | ') || '-')}</td>
        </tr>`
    )
    .join('\n');

  const boundaryRows = state.boundaries
    .map(
      (boundary) => `
        <tr>
          <td>${escapeHtml(boundary.id)}</td>
          <td>${escapeHtml(boundary.state)}</td>
          <td>${escapeHtml(boundary.text)}</td>
        </tr>`
    )
    .join('\n');

  const studyNodes = state.studies.map((study, index) => ({
    id: study.id,
    label: study.id,
    type: 'study',
    x: 120 + index * 180,
    y: 70,
  }));

  const boundaryNodes = state.boundaries.map((boundary, index) => ({
    id: boundary.id,
    label: boundary.id,
    type: 'boundary',
    state: boundary.state,
    x: 120 + (index % 5) * 150,
    y: 220 + Math.floor(index / 5) * 110,
  }));

  const edges = [
    ...state.studies.flatMap((study) => study.resolves.map((boundaryId) => ({ from: study.id, to: boundaryId, kind: 'resolves' }))),
    ...state.studies.flatMap((study) => study.opens.map((boundaryId) => ({ from: study.id, to: boundaryId, kind: 'opens' }))),
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QDD Research Map</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: #ffffff;
        --text: #172033;
        --muted: #5c667a;
        --border: #d9e0ec;
        --study: #2563eb;
        --open: #f59e0b;
        --resolved: #16a34a;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); }
      main { max-width: 1440px; margin: 0 auto; padding: 24px; }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0; color: var(--muted); }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .metric, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
      .metric strong { display: block; font-size: 24px; }
      .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-top: 16px; }
      .stack { display: grid; gap: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--border); vertical-align: top; font-size: 14px; }
      th { color: var(--muted); font-weight: 600; }
      svg { width: 100%; height: 520px; border: 1px solid var(--border); border-radius: 8px; background: #fbfcff; }
      .legend { display: flex; gap: 12px; font-size: 13px; color: var(--muted); margin-bottom: 12px; flex-wrap: wrap; }
      .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 6px; }
      @media (max-width: 1000px) {
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>QDD Research Map</h1>
      <p>One derived view of study evolution and current project boundaries.</p>

      <section class="metrics">
        <div class="metric"><span>Studies</span><strong>${state.studies.length}</strong></div>
        <div class="metric"><span>Boundaries</span><strong>${summary.total}</strong></div>
        <div class="metric"><span>Open</span><strong>${summary.open}</strong></div>
        <div class="metric"><span>Resolved</span><strong>${summary.resolved}</strong></div>
      </section>

      <section class="grid">
        <div class="panel">
          <h2>Graph View</h2>
          <div class="legend">
            <span><span class="dot" style="background: var(--study)"></span>study</span>
            <span><span class="dot" style="background: var(--open)"></span>open boundary</span>
            <span><span class="dot" style="background: var(--resolved)"></span>resolved boundary</span>
          </div>
          <svg id="research-map" viewBox="0 0 1100 520" role="img" aria-label="QDD research map"></svg>
        </div>
        <div class="stack">
          <div class="panel">
            <h2>Study Timeline</h2>
            <table>
              <thead>
                <tr><th>Study</th><th>Kind</th><th>Question</th><th>Resolves</th><th>Opens</th><th>Next Candidates</th></tr>
              </thead>
              <tbody>${studyRows || '<tr><td colspan="6">No studies closed yet.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Boundary Map</h2>
            <table>
              <thead>
                <tr><th>ID</th><th>State</th><th>Text</th></tr>
              </thead>
              <tbody>${boundaryRows || '<tr><td colspan="3">No project boundaries recorded yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
    <script>
      const studyNodes = ${JSON.stringify(studyNodes)};
      const boundaryNodes = ${JSON.stringify(boundaryNodes)};
      const edges = ${JSON.stringify(edges)};
      const svg = document.getElementById('research-map');
      const ns = 'http://www.w3.org/2000/svg';

      function line(x1, y1, x2, y2, color, dash = false) {
        const el = document.createElementNS(ns, 'line');
        el.setAttribute('x1', x1);
        el.setAttribute('y1', y1);
        el.setAttribute('x2', x2);
        el.setAttribute('y2', y2);
        el.setAttribute('stroke', color);
        el.setAttribute('stroke-width', '2');
        if (dash) el.setAttribute('stroke-dasharray', '6 4');
        svg.appendChild(el);
      }

      function text(x, y, value, fill = '#172033', size = 12, weight = '500') {
        const el = document.createElementNS(ns, 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('fill', fill);
        el.setAttribute('font-size', String(size));
        el.setAttribute('font-weight', weight);
        el.setAttribute('text-anchor', 'middle');
        el.textContent = value;
        svg.appendChild(el);
      }

      function rect(x, y, width, height, fill, stroke) {
        const el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('width', width);
        el.setAttribute('height', height);
        el.setAttribute('rx', '8');
        el.setAttribute('fill', fill);
        el.setAttribute('stroke', stroke);
        svg.appendChild(el);
      }

      function circle(x, y, r, fill, stroke) {
        const el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', x);
        el.setAttribute('cy', y);
        el.setAttribute('r', r);
        el.setAttribute('fill', fill);
        el.setAttribute('stroke', stroke);
        svg.appendChild(el);
      }

      const nodeLookup = new Map([...studyNodes, ...boundaryNodes].map((node) => [node.id, node]));

      for (const edge of edges) {
        const from = nodeLookup.get(edge.from);
        const to = nodeLookup.get(edge.to);
        if (!from || !to) continue;
        line(from.x, from.y + 28, to.x, to.y - 18, edge.kind === 'resolves' ? '#16a34a' : '#f59e0b', edge.kind !== 'resolves');
      }

      for (const node of studyNodes) {
        rect(node.x - 54, node.y - 22, 108, 44, '#dbeafe', '#93c5fd');
        text(node.x, node.y + 4, node.label, '#1d4ed8', 13, '600');
      }

      for (const node of boundaryNodes) {
        const fill = node.state === 'resolved' ? '#dcfce7' : '#fef3c7';
        const stroke = node.state === 'resolved' ? '#86efac' : '#fcd34d';
        circle(node.x, node.y, 18, fill, stroke);
        text(node.x, node.y + 4, node.label, node.state === 'resolved' ? '#15803d' : '#b45309', 11, '600');
      }
    </script>
  </body>
</html>
`;

  await FileSystemUtils.writeFile(absoluteOutputPath, html);
  return relativeOutputPath;
}
