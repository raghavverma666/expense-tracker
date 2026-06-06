// ─── NAV ────────────────────────────────────────────────────────────────────

let activeTab = 'dashboard';

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('tab-' + name);
  if (el) el.classList.add('active');

  if (name === 'dashboard')   renderDashboard();
  if (name === 'review')      renderReview();
  if (name === 'settlement')  renderSettlement();
  if (name === 'rules')       renderRules();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function renderDashboard() {
  renderKPIs();
  renderBarChart();
  renderCatChart();
  renderMonthTable();
}

function renderKPIs() {
  const data = allMonthsData();
  const totalRama   = data.reduce((s,m) => s + m.ramaPaid, 0);
  const totalRaghav = data.reduce((s,m) => s + m.raghavPaid, 0);
  const netAll      = data.reduce((s,m) => s + m.net, 0);
  const pending     = transactions.filter(t => !t.approved).length;

  const kpis = [
    { label: 'You paid YTD',   value: fmtCAD(totalRama),   sub: 'all months',       cls: '' },
    { label: 'Raghav paid YTD',value: fmtCAD(totalRaghav), sub: 'all months',       cls: '' },
    { label: 'Net balance',    value: (netAll>=0?'+':'-')+fmtCAD(netAll), sub: netAll>=0?'Raghav owes you':'You owe Raghav', cls: netAll>=0?'kpi-pos':'kpi-neg' },
    { label: 'Months tracked', value: data.length,          sub: 'of 12 in 2026',   cls: '' },
    { label: 'Awaiting review',value: pending,              sub: 'transactions',     cls: pending>0?'kpi-neg':'' },
  ];

  document.getElementById('kpiRow').innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`
  ).join('');
}

function renderBarChart() {
  const data = allMonthsData();
  const maxAbs = Math.max(...data.map(m => Math.abs(m.net)), 1);
  const H = 110;

  const bars = data.map(m => {
    const h = Math.round((Math.abs(m.net) / maxAbs) * H);
    const isPos = m.net >= 0;
    const color = isPos ? '#2D6A4F' : '#9B2335';
    const bg    = isPos ? '#EBF5F0' : '#FDEEF0';
    const label = m.month.replace(' 2026','');
    return `<div class="bar-group">
      <div class="bar-net ${isPos?'pos':'neg'}">${isPos?'+':'-'}${fmtCAD(m.net).replace('$','')}</div>
      <div class="bar-col">
        <div class="bar" style="height:${h}px;background:${color}" data-tip="${m.month}: ${isPos?'+':'-'}${fmtCAD(m.net)}"></div>
      </div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('');

  document.getElementById('barChart').innerHTML = `<div class="bar-chart">${bars}</div>`;
}

function renderCatChart() {
  const data = allMonthsData();
  const totals = {};
  data.forEach(m => {
    if (m.categories) {
      Object.entries(m.categories).forEach(([k,v]) => {
        totals[k] = (totals[k]||0) + v;
      });
    }
  });
  const total = Object.values(totals).reduce((a,b)=>a+b,0)||1;
  const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const catColors = {};
  CATEGORIES.forEach(c => { catColors[c.name] = c.color; });

  document.getElementById('catChart').innerHTML = `<div class="cat-list">${
    sorted.map(([cat, amt]) => {
      const pct = Math.round(amt/total*100);
      const col = catColors[cat] || '#888';
      return `<div class="cat-row">
        <div class="cat-row-label">${cat}</div>
        <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="cat-row-amount">${fmtCAD(amt)}</div>
      </div>`;
    }).join('')
  }</div>`;
}

function renderMonthTable() {
  const data = allMonthsData();
  const head = `<thead><tr>
    <th>Month</th>
    <th class="th-right">You paid</th>
    <th class="th-right">Raghav paid</th>
    <th class="th-right">Raghav owes you</th>
    <th class="th-right">You owe Raghav</th>
    <th class="th-right">Net</th>
  </tr></thead>`;

  const rows = data.map(m => {
    const netCls = m.net > 0 ? 'mt-pos' : m.net < 0 ? 'mt-neg' : 'mt-zero';
    const netStr = (m.net > 0 ? '+' : m.net < 0 ? '-' : '') + fmtCAD(m.net);
    return `<tr>
      <td style="font-weight:500">${m.month}</td>
      <td class="td-right td-mono">${fmtCAD(m.ramaPaid)}</td>
      <td class="td-right td-mono">${fmtCAD(m.raghavPaid)}</td>
      <td class="td-right td-mono">${fmtCAD(m.raghavOwes)}</td>
      <td class="td-right td-mono">${fmtCAD(m.ramaOwes)}</td>
      <td class="td-right ${netCls}">${netStr}</td>
    </tr>`;
  }).join('');

  const totals = data.reduce((acc, m) => ({
    ramaPaid: acc.ramaPaid + m.ramaPaid,
    raghavPaid: acc.raghavPaid + m.raghavPaid,
    raghavOwes: acc.raghavOwes + m.raghavOwes,
    ramaOwes: acc.ramaOwes + m.ramaOwes,
    net: acc.net + m.net,
  }), { ramaPaid:0, raghavPaid:0, raghavOwes:0, ramaOwes:0, net:0 });

  const tNetCls = totals.net > 0 ? 'mt-pos' : totals.net < 0 ? 'mt-neg' : 'mt-zero';
  const totalRow = `<tr style="font-weight:600;border-top:2px solid var(--border-strong);">
    <td>2026 Total</td>
    <td class="td-right td-mono">${fmtCAD(totals.ramaPaid)}</td>
    <td class="td-right td-mono">${fmtCAD(totals.raghavPaid)}</td>
    <td class="td-right td-mono">${fmtCAD(totals.raghavOwes)}</td>
    <td class="td-right td-mono">${fmtCAD(totals.ramaOwes)}</td>
    <td class="td-right ${tNetCls}">${(totals.net>=0?'+':'-') + fmtCAD(totals.net)}</td>
  </tr>`;

  document.getElementById('monthTable').innerHTML = head + `<tbody>${rows}${totalRow}</tbody>`;
}

// ─── REVIEW ──────────────────────────────────────────────────────────────────

let reviewFilter = 'all';

function renderReview() {
  updateCounts();
  let filtered = getFiltered();

  const body = document.getElementById('reviewBody');
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <h3>${transactions.length ? 'No transactions match this filter' : 'No transactions yet'}</h3>
        <p>${transactions.length ? 'Try a different filter' : 'Upload a statement or try the demo data'}</p>
      </div>
    </td></tr>`;
    updateFooter([]);
    return;
  }

  body.innerHTML = filtered.map(tx => {
    const cat = CATEGORIES.find(c => c.name === tx.cat) || CATEGORIES[CATEGORIES.length-1];
    const share = getShare(tx);
    const statusHtml = tx.approved
      ? `<span class="status-badge status-approved">✓ Approved</span>`
      : tx.aiCat
      ? `<span class="status-badge status-ai">AI suggested</span>`
      : `<span class="status-badge status-pending">Needs review</span>`;

    return `<tr data-id="${tx.id}">
      <td><input type="checkbox" class="tx-check" data-id="${tx.id}" ${tx.approved?'checked':''}></td>
      <td style="color:var(--muted);white-space:nowrap;font-size:13px">${tx.date.slice(5)}</td>
      <td>
        <div class="tx-desc">${tx.desc}</div>
        <div class="tx-source">${tx.source}</div>
      </td>
      <td style="font-size:12.5px;color:var(--muted)">${tx.source}</td>
      <td>
        <button class="cat-pill" style="background:${cat.bg};color:${cat.color}" onclick="openCatModal(${tx.id})">
          ${tx.cat} <span class="cat-pencil">✏</span>
        </button>
      </td>
      <td>
        <select class="split-sel" onchange="changeSplit(${tx.id}, this.value)">
          ${['50/50','Rama only','Raghav only'].map(s => `<option ${tx.split===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="td-right td-mono" style="font-weight:500">${fmtCAD(tx.amount)}</td>
      <td class="td-right td-mono" style="color:${share===0?'var(--muted2)':'var(--text)'}">${fmtCAD(share)}</td>
      <td>${statusHtml}</td>
    </tr>`;
  }).join('');

  updateFooter(filtered);
  document.getElementById('reviewSub').textContent =
    `${transactions.filter(t=>!t.approved).length} pending · ${transactions.filter(t=>t.approved).length} approved`;
}

function getFiltered() {
  const q = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  return transactions.filter(tx => {
    const matchFilter =
      reviewFilter === 'all'    ? true :
      reviewFilter === 'pending'? !tx.approved :
      reviewFilter === 'split'  ? tx.split === '50/50' :
      reviewFilter === 'mine'   ? tx.split === 'Rama only' :
      reviewFilter === 'raghav' ? tx.split === 'Raghav only' : true;
    const matchQ = !q || tx.desc.toLowerCase().includes(q) || tx.cat.toLowerCase().includes(q);
    return matchFilter && matchQ;
  });
}

function updateCounts() {
  document.getElementById('cnt-all').textContent    = transactions.length;
  document.getElementById('cnt-pending').textContent = transactions.filter(t=>!t.approved).length;
  document.getElementById('cnt-split').textContent  = transactions.filter(t=>t.split==='50/50').length;
  document.getElementById('cnt-mine').textContent   = transactions.filter(t=>t.split==='Rama only').length;
  document.getElementById('cnt-raghav').textContent = transactions.filter(t=>t.split==='Raghav only').length;
}

function updateFooter(filtered) {
  const total = filtered.reduce((s,t)=>s+t.amount,0);
  const yourShare = filtered.reduce((s,t)=>s+getShare(t),0);
  document.getElementById('reviewFooter').innerHTML = `
    <span>${filtered.length} transactions shown</span>
    <div class="footer-amounts">
      <div class="footer-stat"><span>Total spend: </span><strong>${fmtCAD(total)}</strong></div>
      <div class="footer-stat"><span>Your share: </span><strong>${fmtCAD(yourShare)}</strong></div>
    </div>`;
}

function updateReviewBadge() {
  const n = transactions.filter(t=>!t.approved).length;
  const b = document.getElementById('reviewBadge');
  b.textContent = n;
  b.style.display = n ? 'inline' : 'none';
}

// Filter pills
document.getElementById('filterPills').addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  reviewFilter = pill.dataset.filter;
  renderReview();
});

function changeSplit(id, val) {
  const tx = transactions.find(t => t.id === id);
  if (tx) { tx.split = val; tx.approved = false; }
  updateFooter(getFiltered());
  updateCounts();
}

function toggleAll(cb) {
  const filtered = getFiltered();
  filtered.forEach(tx => { tx.approved = cb.checked; tx.aiCat = false; });
  updateReviewBadge();
  renderReview();
}

function approveAll() {
  transactions.forEach(t => { t.approved = true; t.aiCat = false; });
  updateReviewBadge();
  renderReview();
  showToast('✓ All approved — view Settlement tab');
}

function exportCSV() {
  const headers = ['Date','Description','Source','Category','Split','Amount','Your Share','Status'];
  const rows = transactions.map(t =>
    [t.date, t.desc, t.source, t.cat, t.split, t.amount.toFixed(2), getShare(t).toFixed(2), t.approved?'Approved':'Pending'].join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'expenses-june-2026.csv';
  a.click();
  showToast('✓ CSV exported');
}

// ─── CATEGORY MODAL ──────────────────────────────────────────────────────────

let editingTxId = null;

function openCatModal(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  editingTxId = id;
  document.getElementById('modalTxName').textContent = tx.desc + ' — ' + fmtCAD(tx.amount);
  document.getElementById('rememberMerchant').textContent = tx.desc;
  document.getElementById('catGrid').innerHTML = CATEGORIES.map(c =>
    `<button class="cat-opt ${c.name===tx.cat?'selected':''}" style="background:${c.bg};color:${c.color};${c.name===tx.cat?'outline:2px solid '+c.color+';outline-offset:2px':''}" onclick="selectCat('${c.name}')">${c.name}</button>`
  ).join('');
  document.getElementById('catModal').style.display = 'flex';
}

function selectCat(catName) {
  const tx = transactions.find(t => t.id === editingTxId);
  if (tx) {
    tx.cat = catName;
    tx.approved = false;
    tx.aiCat = false;
    if (document.getElementById('rememberCat').checked) {
      splitRules.unshift({ keyword: tx.desc.toLowerCase(), split: tx.split, note: 'User-defined' });
      showToast('Rule saved for "' + tx.desc + '"');
    }
  }
  closeCatModal();
  renderReview();
}

function closeCatModal(e) {
  if (e && e.target !== document.getElementById('catModal')) return;
  document.getElementById('catModal').style.display = 'none';
  editingTxId = null;
}

// ─── AI BAR ──────────────────────────────────────────────────────────────────

async function runAI() {
  const input = document.getElementById('aiInput');
  const cmd = input.value.trim();
  if (!cmd || !transactions.length) return;

  input.value = '';
  document.getElementById('aiBar').style.display = 'none';
  showToast('AI is updating your transactions…');

  try {
    const updates = await processAICommand(cmd, transactions);
    let changed = 0;
    updates.forEach(u => {
      const tx = transactions.find(t => t.id === u.id);
      if (tx) {
        if (u.cat)   { tx.cat = u.cat; changed++; }
        if (u.split) { tx.split = u.split; changed++; }
        tx.approved = false;
        tx.aiCat = false;
      }
    });
    renderReview();
    showToast(`✓ Updated ${changed} transactions`);
  } catch(e) {
    showToast('Could not process AI command — try again');
  }
}

// ─── SETTLEMENT ──────────────────────────────────────────────────────────────

function renderSettlement() {
  const data = allMonthsData();
  const net = data.reduce((s,m)=>s+m.net,0);
  const total = document.getElementById('settlementContent');

  const cards = data.filter(m=>m.ramaPaid||m.raghavPaid).map(m => {
    const cls = m.net > 0 ? 'settle-pos' : m.net < 0 ? 'settle-neg' : 'settle-zero';
    const desc = m.net > 0 ? 'Raghav owes you' : m.net < 0 ? 'You owe Raghav' : 'Settled';
    return `<div class="settle-card ${cls}">
      <div class="settle-month">${m.month}</div>
      <div class="settle-net">${(m.net>=0?'+':'')}${fmtCAD(m.net)}</div>
      <div class="settle-desc">${desc}</div>
    </div>`;
  }).join('');

  const totalCls = net > 0 ? 'pos' : net < 0 ? 'neg' : '';
  const totalDesc = net > 0 ? 'Raghav owes you in total' : net < 0 ? 'You owe Raghav in total' : 'Fully settled';

  total.innerHTML = `
    <div class="settle-total ${totalCls}">
      <div class="settle-month">2026 Year-to-Date</div>
      <div class="settle-net">${(net>=0?'+':'')}${fmtCAD(net)}</div>
      <div class="settle-desc">${totalDesc}</div>
    </div>
    <div class="settle-grid">${cards}</div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">Month-by-Month Detail</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Month</th><th class="th-right">You paid</th><th class="th-right">Raghav paid</th>
            <th class="th-right">Raghav owes</th><th class="th-right">You owe</th><th class="th-right">Net</th>
          </tr></thead>
          <tbody>${data.map(m=>{
            const cls = m.net>0?'mt-pos':m.net<0?'mt-neg':'mt-zero';
            return `<tr>
              <td style="font-weight:500">${m.month}</td>
              <td class="td-right td-mono">${fmtCAD(m.ramaPaid)}</td>
              <td class="td-right td-mono">${fmtCAD(m.raghavPaid)}</td>
              <td class="td-right td-mono">${fmtCAD(m.raghavOwes)}</td>
              <td class="td-right td-mono">${fmtCAD(m.ramaOwes)}</td>
              <td class="td-right ${cls}">${(m.net>=0?'+':'')+fmtCAD(m.net)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

// ─── RULES ───────────────────────────────────────────────────────────────────

function renderRules() {
  const header = `<div class="rules-col-header">
    <span>Merchant keyword</span><span>Split</span><span>Note</span><span></span>
  </div>`;
  const rows = splitRules.map((r, i) =>
    `<div class="rule-row">
      <input class="rule-input" value="${r.keyword}" onchange="splitRules[${i}].keyword=this.value" placeholder="keyword">
      <select class="rule-select" onchange="splitRules[${i}].split=this.value">
        ${['50/50','Rama only','Raghav only'].map(s=>`<option ${r.split===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <input class="rule-input" value="${r.note}" onchange="splitRules[${i}].note=this.value" placeholder="note (optional)">
      <button class="rule-del" onclick="deleteRule(${i})" title="Delete rule">✕</button>
    </div>`
  ).join('');
  document.getElementById('rulesTable').innerHTML = header + rows;
}

function deleteRule(i) {
  splitRules.splice(i, 1);
  renderRules();
  showToast('Rule deleted');
}

function addRule() {
  splitRules.push({ keyword: '', split: '50/50', note: '' });
  renderRules();
  document.querySelectorAll('.rule-input')[splitRules.length * 3 - 3]?.focus();
}

async function suggestRules() {
  const input = document.getElementById('aiRuleInput').value.trim();
  if (!input) return;
  const el = document.getElementById('rulesSuggestions');
  el.innerHTML = `<div class="ai-thinking"><div class="ai-thinking-spinner"></div>AI is generating rule suggestions…</div>`;
  try {
    const suggestions = await suggestSplitRules(input);
    if (!suggestions.length) { el.innerHTML = '<p style="font-size:13px;color:var(--muted)">No suggestions returned. Try being more specific.</p>'; return; }
    el.innerHTML = suggestions.map((s, i) =>
      `<div class="suggestion-item">
        <div>
          <strong>${s.keyword}</strong> → <code style="font-size:12px;background:var(--surface2);padding:2px 6px;border-radius:4px">${s.split}</code>
          <span style="color:var(--muted);font-size:12px;margin-left:8px">${s.note}</span>
        </div>
        <button onclick="addSuggestedRule(${i}, ${JSON.stringify(s).replace(/"/g,'&quot;')})">Add rule</button>
      </div>`
    ).join('');
  } catch(e) {
    el.innerHTML = '<p style="font-size:13px;color:var(--red)">Could not fetch suggestions. Check your connection.</p>';
  }
}

function addSuggestedRule(i, rule) {
  splitRules.push(rule);
  renderRules();
  showToast('✓ Rule added: "' + rule.keyword + '"');
  document.querySelectorAll('.suggestion-item')[i].style.opacity = '0.4';
}

// ─── DROPZONE DRAG EVENTS ─────────────────────────────────────────────────────

const dz = document.getElementById('dropzone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

renderDashboard();
