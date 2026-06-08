const fs = require('fs');
const path = require('path');

const LEGAL_DIR = path.join(__dirname, '..', 'public', 'legal');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const POLICY_MAPPING = {
  'PRIVACY_POLICY.md': {
    target: 'privacy-policy.html',
    title: 'Privacy Policy',
    current: 'privacy'
  },
  'TERMS_OF_SERVICE.md': {
    target: 'terms-of-service.html',
    title: 'Terms of Service',
    current: 'terms'
  },
  'REFUND_POLICY.md': {
    target: 'refund-policy.html',
    title: 'Refund Policy',
    current: 'refund'
  }
};

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function renderTableHtml(rows) {
  if (rows.length < 2) return rows.join('\n');

  const getCells = (row) => {
    const clean = row.replace(/^\|/, '').replace(/\|$/, '');
    return clean.split('|').map(c => c.trim());
  };

  const headers = getCells(rows[0]);
  const separator = rows[1];
  
  const isSeparator = /^[|:\s-]+$/.test(separator);
  if (!isSeparator) {
    return rows.join('\n');
  }

  const colCount = headers.length;
  // For 2 columns (e.g. Scope / What we access) -> 30% / 70%.
  // For 3 columns -> 25% / 50% / 25% (middle column gets the most space).
  // For 4 columns -> 25% / 30% / 30% / 15% (last column is for short labels,
  // middle columns hold long descriptions).
  const isTwoCol = colCount === 2;
  const firstPct = 25;
  const lastPct = isTwoCol ? 70 : (colCount === 3 ? 25 : 15);
  const middleTotal = Math.max(0, 100 - firstPct - lastPct);
  const middleEach = colCount > 2 ? (middleTotal / (colCount - 2)) : 0;
  const colPcts = headers.map((_, i) => {
    if (i === 0) return firstPct;
    if (i === colCount - 1) return lastPct;
    return middleEach;
  });

  let html = '<div class="table-container">\n<table>\n  <colgroup>\n';
  colPcts.forEach((p) => {
    html += `    <col style="width:${p}%">\n`;
  });
  html += '  </colgroup>\n  <thead>\n    <tr>\n';
  headers.forEach(h => {
    html += `      <th>${h}</th>\n`;
  });
  html += '    </tr>\n  </thead>\n  <tbody>\n';

  for (let i = 2; i < rows.length; i++) {
    const cells = getCells(rows[i]);
    html += '    <tr>\n';
    for (let j = 0; j < headers.length; j++) {
      const cellVal = cells[j] || '';
      const cellClass = j === 0 ? ' class="col-scope"' : (j === headers.length - 1 ? ' class="col-last"' : '');
      html += `      <td${cellClass}>${cellVal}</td>\n`;
    }
    html += '    </tr>\n';
  }

  html += '  </tbody>\n</table>\n</div>';
  return html;
}

function simpleMarkdownToHtml(markdown) {
  let text = markdown.replace(/\r\n/g, '\n');
  
  // Normalize blank lines containing spaces
  text = text.replace(/^\s*$/gm, '');
  
  // Escape HTML entities
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Parse tables first
  const lines = text.split('\n');
  const processedLines = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    
    if (isTableRow) {
      inTable = true;
      tableRows.push(line);
    } else {
      if (inTable) {
        processedLines.push(renderTableHtml(tableRows));
        tableRows = [];
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable && tableRows.length > 0) {
    processedLines.push(renderTableHtml(tableRows));
  }
  text = processedLines.join('\n');

  // Split into blocks by double newlines
  const blocks = text.split(/\n{2,}/);
  const parsedBlocks = blocks.map(block => {
    let t = block.trim();
    if (!t) return '';

    // Standard blocks
    if (t.startsWith('<div class="table-container">')) {
      return t;
    }

    // Headers
    if (t.startsWith('### ')) {
      const headingText = t.slice(4);
      return `<h3 id="${slugifyHeading(headingText)}">${headingText}</h3>`;
    }
    if (t.startsWith('## ')) {
      const headingText = t.slice(3);
      return `<h2 id="${slugifyHeading(headingText)}">${headingText}</h2>`;
    }
    if (t.startsWith('# ')) {
      return `<h1-skip>${t.slice(2)}</h1-skip>`;
    }

    // Blockquotes
    if (t.startsWith('&gt; ')) {
      const content = t.replace(/^&gt;\s+/gm, '');
      return `<blockquote>${content}</blockquote>`;
    }

    // Horizontal Rule
    if (t === '---') {
      return '<hr>';
    }

    // Lists (unordered)
    if (t.startsWith('- ') || t.startsWith('* ')) {
      const listLines = t.split('\n');
      const listHtml = listLines.map(line => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
          return `  <li>${cleanLine.slice(2)}</li>`;
        }
        return `  ${cleanLine}`;
      }).join('\n');
      return `<ul>\n${listHtml}\n</ul>`;
    }

    // Paragraph
    // A single newline is replaced by a space to prevent huge gaps.
    const linesOfPara = t.split('\n').map((line, idx, arr) => {
      if (idx === arr.length - 1) return line;
      if (line.endsWith('  ')) {
        return line.slice(0, -2) + '<br>';
      }
      return line;
    });
    
    const joinedPara = linesOfPara.join(' ');
    return `<p>${joinedPara}</p>`;
  });

  let html = parsedBlocks.filter(Boolean).join('\n');

  // Inline styling (applied globally)
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic (single asterisk, not double)
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Autolink email addresses
  html = html.replace(/(?<!mailto:)(?<!">)(?<![a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');

  // Autolink web URLs
  html = html.replace(/(?<!href=")(?<!">)(?<![a-zA-Z0-9._~:/?#@!$&'()*+,;=-])(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<]*)?)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');


  return html;
}

function buildNavHtml(current) {
  const sep = '<span style="color:#ccc;margin:0 2px;">|</span>';
  const items = [
    { label: 'Back to Orkest', href: '/', key: 'home' },
    { label: 'Privacy', href: '/privacy-policy.html', key: 'privacy' },
    { label: 'Terms', href: '/terms-of-service.html', key: 'terms' },
    { label: 'Refund Policy', href: '/refund-policy.html', key: 'refund' },
  ];

  return items.map((item, i) => {
    const isActive = item.key === current;
    const link = `<a href="${item.href}" style="color:${isActive ? '#111' : '#6b6b6b'};text-decoration:none;font-size:14px;" onmouseover="this.style.color='#000'" onmouseout="this.style.color='${isActive ? '#111' : '#6b6b6b'}'">${item.label}</a>`;
    return i === 0 ? link : sep + link;
  }).join('');
}

function generateStaticHtml() {
  console.log('Generating styled static HTML legal files in public/ directory...');

  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`Error: Legal directory not found at ${LEGAL_DIR}`);
    process.exit(1);
  }

  for (const [mdFile, config] of Object.entries(POLICY_MAPPING)) {
    const mdPath = path.join(LEGAL_DIR, mdFile);
    const htmlPath = path.join(PUBLIC_DIR, config.target);

    if (!fs.existsSync(mdPath)) {
      console.warn(`Warning: Markdown file not found at ${mdPath}, skipping.`);
      continue;
    }

    console.log(`Converting ${mdFile} → ${config.target}...`);
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const bodyContent = simpleMarkdownToHtml(mdContent);
    const navHtml = buildNavHtml(config.current);

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title} | Orkest</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #ffffff;
      color: #3c3841;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    .page-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      background-color: #ffffff;
    }

    .content-wrap {
      width: 100%;
      max-width: 48rem;
      padding: 4rem 1.5rem;
    }

    /* Top nav */
    .top-nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      font-size: 0.875rem;
      flex-wrap: wrap;
    }

    .top-nav a {
      text-decoration: none;
      color: #6b6b6b;
      transition: color 0.15s;
    }

    .top-nav a:hover { color: #000; }
    .top-nav a.active { color: #111; }
    .top-nav .sep { color: #ccc; }

    /* Article */
    article h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111;
      margin-bottom: 1.5rem;
      line-height: 1.3;
    }

    article h2 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #111;
      margin-top: 1.75rem;
      margin-bottom: 0.75rem;
      scroll-margin-top: 5rem;
    }

    article h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #111;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      scroll-margin-top: 5rem;
    }

    article h1-skip {
      display: none; /* hide duplicate h1 from markdown */
    }

    article p {
      margin-bottom: 0.875rem;
      color: #3c3841;
      font-size: 0.9375rem;
    }

    article ul, article ol {
      margin: 0 0 0.875rem 1.5rem;
      color: #3c3841;
      font-size: 0.9375rem;
    }

    article li { margin-bottom: 0.375rem; }

    article a {
      color: #111;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    article a:hover { color: #000; }

    article code {
      font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      background: rgba(0,0,0,0.05);
      padding: 0.15em 0.4em;
      border-radius: 4px;
    }

    article blockquote {
      border-left: 3px solid #e5e5e5;
      margin: 0.875rem 0;
      padding-left: 1rem;
      color: #6b6b6b;
      font-style: italic;
    }

    article hr {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 1.5rem 0;
    }

    article strong { font-weight: 600; color: #111; }

    /* Tables Styling */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
      color: #3c3841;
      table-layout: fixed;
    }

    th {
      background-color: #f9f9fb;
      color: #111;
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e5e5e5;
      vertical-align: top;
      word-wrap: break-word;
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e5e5e5;
      vertical-align: top;
      line-height: 1.5;
      word-wrap: break-word;
    }

    td.col-scope {
      font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    td.col-scope code,
    td.col-scope a {
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
    }

    td.col-last {
      word-wrap: break-word;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) {
      background-color: #fcfcfd;
    }


    /* Footer */
    .page-footer {
      margin-top: 4rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 0.75rem;
      color: #888;
    }

    @media (max-width: 640px) {
      .content-wrap { padding: 2rem 1.25rem; }
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="content-wrap">

      <nav class="top-nav">
        <a href="/">Back to Orkest</a>
        <span class="sep">|</span>
        <a href="/privacy-policy.html" class="${config.current === 'privacy' ? 'active' : ''}">Privacy</a>
        <span class="sep">|</span>
        <a href="/terms-of-service.html" class="${config.current === 'terms' ? 'active' : ''}">Terms</a>
        <span class="sep">|</span>
        <a href="/refund-policy.html" class="${config.current === 'refund' ? 'active' : ''}">Refund Policy</a>
      </nav>

      <article>
        <h1>${config.title}</h1>
        <div>
          ${bodyContent}
        </div>
      </article>

      <footer class="page-footer">
        <p>© ${new Date().getFullYear()} Orkest. All rights reserved.</p>
      </footer>

    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
    console.log(`  ✓ Generated ${htmlPath}`);
  }

  console.log('Done.');
}

generateStaticHtml();
module.exports = { generateStaticHtml };
