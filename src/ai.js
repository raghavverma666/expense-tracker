// ─── ANTHROPIC API INTEGRATION ──────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  return data.content[0].text;
}

// ─── PARSE ANY RAW TEXT → TRANSACTIONS ───────────────────────────────────────

async function parseStatementWithAI(rawText, sourceLabel) {
  const system = `You are a financial transaction parser. Extract transactions from bank/credit card statements.
The input may be from a PDF, CSV, copied text, or any bank format (BMO, TD, CIBC, Scotiabank, RBC, Tangerine, Wise, PayPal, etc).
Look for lines with dates, descriptions, and dollar amounts.
For BMO statements: "Amounts deducted from your account" = expense, "Amounts added to your account" = income (skip income/transfers in).
Return ONLY a JSON array, no markdown, no explanation.
Each item: { "date": "YYYY-MM-DD", "desc": "merchant name cleaned up", "amount": number (always positive), "type": "debit"|"credit" }
Ignore: opening/closing balances, headers, page numbers, bank notices, AIR MILES info, summaries.
Only real spending transactions. Maximum 60 items.`;

  const user = `Statement source: ${sourceLabel}\n\nRaw text:\n${rawText.slice(0, 8000)}`;

  try {
    const raw = await callClaude(system, user);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.filter(t => t.amount > 0 && t.desc && t.date);
  } catch(e) {
    console.error('Parse error:', e);
    return [];
  }
}

// ─── CATEGORIZE A BATCH OF TRANSACTIONS ──────────────────────────────────────

async function categorizeBatch(txList) {
  const cats = CATEGORIES.map(c => c.name).join(', ');
  const rules = splitRules.map(r => `"${r.keyword}" → ${r.split}`).join('\n');

  const system = `You are an expense categorizer for a Canadian creator business. 
Available categories: ${cats}
Split rules (keyword → who pays):
${rules}

Return ONLY a JSON array matching the input order.
Each item: { "cat": "category name", "split": "50/50"|"Rama only"|"Raghav only" }
No markdown, no explanation.`;

  const user = JSON.stringify(txList.map(t => ({ desc: t.desc, amount: t.amount })));

  try {
    const raw = await callClaude(system, user);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    return txList.map(t => ({ cat: 'Misc', split: applySplitRule(t.desc) }));
  }
}

// ─── AI COMMAND PARSER ───────────────────────────────────────────────────────

async function processAICommand(command, currentTxs) {
  const system = `You manage expense transactions for Rama (Canadian creator). 
When given a natural language command, return a JSON array of transaction updates.
Each item: { "id": number, "cat": "new category or null", "split": "new split or null" }
Only return items that change. Return ONLY valid JSON array. No markdown.
Available categories: ${CATEGORIES.map(c=>c.name).join(', ')}
Available splits: "50/50", "Rama only", "Raghav only"`;

  const user = `Command: "${command}"\n\nTransactions:\n${JSON.stringify(currentTxs.map(t => ({ id: t.id, desc: t.desc, cat: t.cat, split: t.split, amount: t.amount })))}`;

  try {
    const raw = await callClaude(system, user);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    return [];
  }
}

// ─── RULE SUGGESTER ──────────────────────────────────────────────────────────

async function suggestSplitRules(description) {
  const system = `You suggest split rules for a shared expense tracker between Rama and Raghav (50/50 business partners).
Based on the description, return a JSON array of rule suggestions.
Each item: { "keyword": "merchant keyword", "split": "50/50"|"Rama only"|"Raghav only", "note": "brief reason" }
Return 3-6 rules max. ONLY JSON array, no markdown.`;

  try {
    const raw = await callClaude(system, description);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    return [];
  }
}

// ─── FILE READERS ─────────────────────────────────────────────────────────────

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ─── PDF READER via Claude vision ────────────────────────────────────────────

async function readPDFWithClaude(file) {
  const base64 = await readFileAsBase64(file);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            }
          },
          {
            type: 'text',
            text: `Extract ALL financial transactions from this bank statement.
Return ONLY a JSON array, no markdown, no explanation.
Each item: { "date": "YYYY-MM-DD", "desc": "merchant/description", "amount": number (positive), "type": "debit"|"credit" }
For BMO: rows under "Amounts deducted from your account" are debits (expenses).
Rows under "Amounts added to your account" are credits (income - still include them).
Ignore: opening balance, closing balance, headers, bank notices, page numbers.
Include ALL real money movements. Year is 2026 unless stated otherwise.`
          }
        ]
      }]
    }),
  });

  if (!res.ok) throw new Error('PDF read failed: ' + res.status);
  const data = await res.json();
  const raw = data.content[0].text;
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── PROCESS PASTED TEXT ─────────────────────────────────────────────────────

async function processPastedText(text, sourceLabel) {
  if (!text || text.trim().length < 20) {
    showToast('Paste some statement text first');
    return;
  }

  const card = document.getElementById('processingCard');
  const log  = document.getElementById('processingLog');
  card.style.display = 'block';
  log.innerHTML = '';

  function addLog(msg, state = 'loading') {
    const el = document.createElement('div');
    el.className = 'log-line ' + state;
    el.innerHTML = state === 'loading'
      ? `<div class="log-spinner"></div>${msg}`
      : state === 'done'
      ? `<span class="log-check">✓</span>${msg}`
      : `<span style="color:var(--red)">✗</span>${msg}`;
    log.appendChild(el);
    return el;
  }

  const parseLine = addLog('Reading pasted text with AI…');
  const parsed = await parseStatementWithAI(text, sourceLabel || 'Pasted text');
  parseLine.className = 'log-line done';
  parseLine.innerHTML = `<span class="log-check">✓</span>Found ${parsed.length} transactions`;

  if (!parsed.length) {
    addLog('No transactions found — make sure you copied the full statement', 'error');
    return;
  }

  const catLine = addLog('Categorizing & applying split rules…');
  const categorized = await categorizeBatch(parsed);
  catLine.className = 'log-line done';
  catLine.innerHTML = `<span class="log-check">✓</span>Categorized all transactions`;

  const newTxs = parsed.map((t, i) => ({
    id: nextTxId++,
    date: t.date,
    desc: t.desc,
    amount: t.amount,
    source: sourceLabel || 'Pasted',
    cat: categorized[i]?.cat || 'Misc',
    split: categorized[i]?.split || applySplitRule(t.desc),
    approved: false,
    aiCat: true,
  }));

  transactions = [...transactions, ...newTxs];
  updateReviewBadge();
  addLog(`Ready — ${newTxs.length} transactions to review`, 'done');
  showToast(`✓ ${newTxs.length} transactions extracted from pasted text`);
  setTimeout(() => switchTab('review'), 800);
}

// ─── MAIN UPLOAD HANDLER ─────────────────────────────────────────────────────

async function handleFiles(files) {
  if (!files || !files.length) return;

  const card = document.getElementById('processingCard');
  const log  = document.getElementById('processingLog');
  const filesCard = document.getElementById('uploadedFilesCard');
  const filesList = document.getElementById('uploadedFilesList');
  card.style.display = 'block';
  filesCard.style.display = 'block';
  log.innerHTML = '';

  function addLog(msg, state = 'loading') {
    const el = document.createElement('div');
    el.className = 'log-line ' + state;
    el.innerHTML = state === 'loading'
      ? `<div class="log-spinner"></div>${msg}`
      : state === 'done'
      ? `<span class="log-check">✓</span>${msg}`
      : `<span style="color:var(--red)">✗</span>${msg}`;
    log.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
    return el;
  }

  let allNew = [];

  for (const file of Array.from(files)) {
    const fileEl = document.createElement('div');
    fileEl.className = 'uploaded-file';
    fileEl.innerHTML = `<svg class="file-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${file.name}`;
    filesList.appendChild(fileEl);

    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    let parsed = [];

    if (isPDF) {
      const readLine = addLog(`Reading PDF with AI vision: ${file.name}…`);
      try {
        parsed = await readPDFWithClaude(file);
        parsed = parsed.filter(t => t.amount > 0 && t.desc && t.date);
        readLine.className = 'log-line done';
        readLine.innerHTML = `<span class="log-check">✓</span>PDF read — found ${parsed.length} transactions`;
      } catch(e) {
        // fallback: try reading as text
        readLine.innerHTML = `<div class="log-spinner"></div>PDF vision failed, trying text fallback…`;
        try {
          const text = await readFileAsText(file);
          parsed = await parseStatementWithAI(text, file.name);
          readLine.className = 'log-line done';
          readLine.innerHTML = `<span class="log-check">✓</span>Read as text — found ${parsed.length} transactions`;
        } catch(e2) {
          readLine.className = 'log-line error';
          readLine.innerHTML = `<span style="color:var(--red)">✗</span>Could not read PDF — try the Paste Text option`;
          continue;
        }
      }
    } else {
      const readLine = addLog(`Reading ${file.name}…`);
      try {
        const text = await readFileAsText(file);
        readLine.className = 'log-line done';
        readLine.innerHTML = `<span class="log-check">✓</span>Read ${file.name}`;
        const parseLine = addLog('Extracting transactions with AI…');
        parsed = await parseStatementWithAI(text, file.name);
        parseLine.className = 'log-line done';
        parseLine.innerHTML = `<span class="log-check">✓</span>Found ${parsed.length} transactions`;
      } catch(e) {
        addLog(`Could not read ${file.name}`, 'error');
        continue;
      }
    }

    if (!parsed.length) {
      addLog('No transactions found in this file', 'error');
      continue;
    }

    const catLine = addLog('Categorizing & applying split rules…');
    const categorized = await categorizeBatch(parsed);
    catLine.className = 'log-line done';
    catLine.innerHTML = `<span class="log-check">✓</span>Categorized all transactions`;

    const newTxs = parsed.map((t, i) => ({
      id: nextTxId++,
      date: t.date,
      desc: t.desc,
      amount: t.amount,
      source: file.name,
      cat: categorized[i]?.cat || 'Misc',
      split: categorized[i]?.split || applySplitRule(t.desc),
      approved: false,
      aiCat: true,
    }));
    allNew = [...allNew, ...newTxs];
  }

  if (allNew.length) {
    transactions = [...transactions, ...allNew];
    updateReviewBadge();
    addLog(`Ready — ${allNew.length} transactions to review`, 'done');
    showToast(`✓ ${allNew.length} transactions extracted`);
    setTimeout(() => switchTab('review'), 800);
  } else {
    addLog('No transactions found. Try the Paste Text option below ↓', 'error');
  }
}
