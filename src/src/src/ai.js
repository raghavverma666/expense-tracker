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

// ─── PARSE UPLOADED FILE TEXT → TRANSACTIONS ─────────────────────────────────

async function parseStatementWithAI(rawText, sourceLabel) {
  const system = `You are a financial transaction parser. Extract transactions from bank/credit card statements.
Return ONLY a JSON array, no markdown, no explanation.
Each item: { "date": "YYYY-MM-DD", "desc": "merchant name", "amount": number (always positive), "type": "debit"|"credit" }
Ignore headers, summaries, balance rows. Only real transactions. Maximum 50 items.`;

  const user = `Statement source: ${sourceLabel}\n\nRaw text:\n${rawText.slice(0, 6000)}`;

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

// ─── AI COMMAND PARSER (review tab AI bar) ───────────────────────────────────

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

// ─── CSV TEXT READER ─────────────────────────────────────────────────────────

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
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

    const readLine = addLog(`Reading ${file.name}…`);
    let text = '';
    try {
      text = await readFileAsText(file);
      readLine.className = 'log-line done';
      readLine.innerHTML = `<span class="log-check">✓</span>Read ${file.name}`;
    } catch(e) {
      readLine.className = 'log-line error';
      readLine.innerHTML = `<span style="color:var(--red)">✗</span>Could not read file`;
      continue;
    }

    const parseLine = addLog('Extracting transactions with AI…');
    const parsed = await parseStatementWithAI(text, file.name);
    parseLine.className = 'log-line done';
    parseLine.innerHTML = `<span class="log-check">✓</span>Found ${parsed.length} transactions`;

    if (!parsed.length) continue;

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
    addLog('No transactions found. Try a CSV or text-based file.', 'error');
  }
}
