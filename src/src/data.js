// ─── CATEGORIES ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Food & drinks',          bg: '#EBF5F0', color: '#2D6A4F' },
  { name: 'Groceries & household',  bg: '#EFF6FF', color: '#1E40AF' },
  { name: 'Transport',              bg: '#FEF3C7', color: '#92400E' },
  { name: 'Tools & software',       bg: '#F5F3FF', color: '#5B21B6' },
  { name: 'Fixed expense',          bg: '#FDE8E8', color: '#9B2335' },
  { name: 'Business expense',       bg: '#FFF7ED', color: '#9A3412' },
  { name: 'Entertainment',          bg: '#FDF4FF', color: '#7E22CE' },
  { name: 'Investment',             bg: '#F0FDF4', color: '#166534' },
  { name: 'Bank charges',           bg: '#F1F5F9', color: '#475569' },
  { name: 'Misc',                   bg: '#F9FAFB', color: '#6B7280' },
];

// ─── DEFAULT SPLIT RULES ────────────────────────────────────────────────────
// These are editable in the Rules tab; also used by AI to pre-fill splits
let splitRules = [
  { keyword: 'rogers',        split: 'Rama only',   note: 'Personal phone bill' },
  { keyword: 'car insurance', split: '50/50',       note: 'Shared vehicle' },
  { keyword: 'home insurance',split: '50/50',       note: 'Shared home' },
  { keyword: 'rent',          split: '50/50',       note: 'Shared home' },
  { keyword: 'bmw',           split: '50/50',       note: 'Car payment' },
  { keyword: 'shopify',       split: '50/50',       note: 'Business' },
  { keyword: 'costco gas',    split: '50/50',       note: 'Shared fuel' },
  { keyword: 'costco',        split: '50/50',       note: 'Shared groceries' },
  { keyword: 'manychat',      split: 'Rama only',   note: 'Your subscription' },
  { keyword: 'apple',         split: 'Rama only',   note: 'Personal apple' },
  { keyword: 'gym',           split: 'Raghav only', note: 'Personal gym' },
  { keyword: 'planet fitness',split: 'Raghav only', note: 'Personal gym' },
  { keyword: 'planet fitness',split: 'Raghav only', note: 'Personal gym' },
  { keyword: 'wealthsimple',  split: 'Rama only',   note: 'Personal investment' },
  { keyword: 'claude ai',     split: '50/50',       note: 'Shared tool' },
  { keyword: 'picsart',       split: 'Raghav only', note: 'Raghav subscription' },
];

// ─── HISTORICAL DATA ────────────────────────────────────────────────────────
const HISTORY = [
  {
    month: 'Jan 2026',
    ramaPaid: 692.48, raghavPaid: 1251.73,
    raghavOwes: 346.24, ramaOwes: 625.87,
    net: -279.63,
    categories: {
      'Transport': 280, 'Groceries & household': 264.29,
      'Tools & software': 131.11, 'Misc': 63.86, 'Fixed expense': 1181.73,
    }
  },
  {
    month: 'Feb 2026',
    ramaPaid: 1086.09, raghavPaid: 1160.79,
    raghavOwes: 543.05, ramaOwes: 580.40,
    net: -37.35,
    categories: {
      'Food & drinks': 399.30, 'Transport': 313.40,
      'Tools & software': 381.56, 'Groceries & household': 272.28,
      'Entertainment': 80.23, 'Misc': 9.58, 'Fixed expense': 146.90,
    }
  },
  {
    month: 'Mar 2026',
    ramaPaid: 4791.35, raghavPaid: 1785.00,
    raghavOwes: 1402.34, ramaOwes: 892.50,
    net: 509.84,
    categories: {
      'Fixed expense': 2898.45, 'Food & drinks': 218.36,
      'Business expense': 83.82, 'Misc': 364.01, 'Tools & software': 112.72,
    }
  },
  {
    month: 'Apr 2026',
    ramaPaid: 5018.72, raghavPaid: 2087.93,
    raghavOwes: 2345.84, ramaOwes: 687.36,
    net: 1658.48,
    categories: {
      'Business expense': 2432.87, 'Fixed expense': 2128.41,
      'Food & drinks': 290.55, 'Transport': 421.19,
      'Groceries & household': 196.57, 'Tools & software': 275.32, 'Misc': 105.62,
    }
  },
  {
    month: 'May 2026',
    ramaPaid: 0, raghavPaid: 3201.89,
    raghavOwes: 0, ramaOwes: 682.77,
    net: -682.77,
    categories: {
      'Business expense': 1862.87, 'Food & drinks': 310.25,
      'Transport': 406.83, 'Fixed expense': 189.00, 'Misc': 432.94,
    }
  },
];

// ─── CURRENT TRANSACTIONS (starts empty, populated by upload or demo) ───────
let transactions = [];
let nextTxId = 1000;

// ─── DEMO TRANSACTIONS ───────────────────────────────────────────────────────
const DEMO_TRANSACTIONS = [
  { date: '2026-06-01', desc: 'Osmows', amount: 28.45,    source: 'Credit card',  cat: 'Food & drinks',         split: '50/50',       approved: false },
  { date: '2026-06-01', desc: 'Rogers Bill', amount: 87.54, source: 'Credit card', cat: 'Fixed expense',        split: 'Rama only',   approved: false },
  { date: '2026-06-02', desc: 'Costco Gas', amount: 94.20, source: 'Debit',       cat: 'Transport',             split: '50/50',       approved: false },
  { date: '2026-06-02', desc: 'Shopify', amount: 35.13,    source: 'India account', cat: 'Tools & software',   split: '50/50',       approved: false },
  { date: '2026-06-03', desc: 'Car Insurance', amount: 537.14, source: 'Credit card', cat: 'Fixed expense',    split: '50/50',       approved: false },
  { date: '2026-06-03', desc: 'Starbucks', amount: 16.80,  source: 'Credit card',  cat: 'Food & drinks',        split: '50/50',       approved: false },
  { date: '2026-06-04', desc: 'Claude AI Subscription', amount: 31.64, source: 'Credit card', cat: 'Tools & software', split: '50/50', approved: false },
  { date: '2026-06-04', desc: 'Rent June 2026', amount: 1150.00, source: 'Debit',  cat: 'Fixed expense',        split: '50/50',       approved: false },
  { date: '2026-06-05', desc: 'Uber Eats', amount: 42.30,  source: 'Credit card',  cat: 'Food & drinks',        split: '50/50',       approved: false },
  { date: '2026-06-05', desc: 'No Frills', amount: 56.78,  source: 'Debit',        cat: 'Groceries & household', split: '50/50',      approved: false },
  { date: '2026-06-06', desc: 'BMW Financial', amount: 272.58, source: 'Debit',    cat: 'Fixed expense',        split: '50/50',       approved: false },
  { date: '2026-06-06', desc: 'Manychat', amount: 54.69,   source: 'Credit card',  cat: 'Tools & software',     split: 'Rama only',   approved: false },
  { date: '2026-06-07', desc: 'Osmows', amount: 31.62,     source: 'Credit card',  cat: 'Food & drinks',        split: '50/50',       approved: false },
  { date: '2026-06-08', desc: 'Apple.com', amount: 28.24,  source: 'Credit card',  cat: 'Tools & software',     split: 'Rama only',   approved: false },
  { date: '2026-06-09', desc: 'Popular Car Wash', amount: 22.04, source: 'Debit',  cat: 'Transport',            split: '50/50',       approved: false },
  { date: '2026-06-10', desc: 'Home Insurance', amount: 31.16, source: 'Credit card', cat: 'Fixed expense',     split: '50/50',       approved: false },
  { date: '2026-06-10', desc: 'No Frills', amount: 43.22,  source: 'Debit',        cat: 'Groceries & household', split: '50/50',      approved: false },
  { date: '2026-06-11', desc: 'Wealthsimple ETF', amount: 25.00, source: 'Debit',  cat: 'Investment',           split: 'Rama only',   approved: false },
  { date: '2026-06-12', desc: 'Dollarama', amount: 8.75,   source: 'Credit card',  cat: 'Groceries & household', split: '50/50',      approved: false },
  { date: '2026-06-12', desc: 'AI Sweets', amount: 22.07,  source: 'Credit card',  cat: 'Food & drinks',        split: '50/50',       approved: false },
];

function applySplitRule(desc) {
  const lower = desc.toLowerCase();
  for (const rule of splitRules) {
    if (lower.includes(rule.keyword.toLowerCase())) return rule.split;
  }
  return '50/50';
}

function loadDemo() {
  transactions = DEMO_TRANSACTIONS.map((t, i) => ({
    ...t,
    id: nextTxId++,
    split: applySplitRule(t.desc),
    aiCat: true,
  }));
  updateReviewBadge();
  showToast('✓ Sample data loaded — ' + transactions.length + ' transactions');
  switchTab('review');
}

function getShare(tx) {
  if (tx.split === 'Rama only')   return tx.amount;
  if (tx.split === 'Raghav only') return 0;
  return tx.amount / 2;
}

function getRaghavShare(tx) {
  if (tx.split === 'Raghav only') return tx.amount;
  if (tx.split === 'Rama only')   return 0;
  return tx.amount / 2;
}

function currentMonthSummary() {
  const approved = transactions.filter(t => t.approved);
  if (!approved.length) return null;
  const ramaPaid     = approved.reduce((s,t) => s + t.amount, 0);
  const raghavOwes   = approved.reduce((s,t) => s + getRaghavShare(t), 0);
  const ramaShare    = approved.reduce((s,t) => s + getShare(t), 0);
  return { month: 'Jun 2026', ramaPaid, raghavPaid: 0, raghavOwes, ramaOwes: 0, net: raghavOwes };
}

function allMonthsData() {
  const cur = currentMonthSummary();
  return cur ? [...HISTORY, cur] : HISTORY;
}

function fmtCAD(n) {
  return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
