// ---- Config ----
const API = 'https://api.binance.com/api/v3/klines'; // public, CORS enabled
const INTERVAL = '1h'; // 1-hour candles
const DEFAULT_LIMIT = 168; // 1 week default

// ---- DOM ----
const elChart = document.getElementById('chart');
const elSymbol = document.getElementById('symbol');
const elRefresh = document.getElementById('refresh');
const elAvgPrice = document.getElementById('avgPrice');
const elSize = document.getElementById('size');
const elSave = document.getElementById('save');
const elClear = document.getElementById('clear');
const elLast = document.getElementById('lastPrice');
const elAvgView = document.getElementById('avgPriceView');
const elSizeView = document.getElementById('sizeView');
const elPnl = document.getElementById('pnl');
const elRoe = document.getElementById('roe');
const elShowAvgLabel = document.getElementById('showAvgLabel');
const elShowLastLine = document.getElementById('showLastLine');
const rangeBtns = Array.from(document.querySelectorAll('.range-buttons button'));

// ---- Chart Setup ----
const chart = LightweightCharts.createChart(elChart, {
  layout: { background: { color: '#121621' }, textColor: '#e6e7ea' },
  rightPriceScale: {
    borderVisible: true,
    borderColor: '#1e2533',
    entireTextOnly: false,
    visible: true,
    scaleMargins: { top: 0.15, bottom: 0.15 },
  },
  timeScale: { borderColor: '#1e2533', timeVisible: true, secondsVisible: false },
  grid: { vertLines: { color: '#1e2533' }, horzLines: { color: '#1e2533' } },
  crosshair: { mode: LightweightCharts.CrosshairMode.Magnet },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#18b26b',
  downColor: '#ff5d5d',
  borderDownColor: '#ff5d5d',
  borderUpColor: '#18b26b',
  wickDownColor: '#ff5d5d',
  wickUpColor: '#18b26b',
});

let lastLine = null;
let avgLine = null;

function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function keyFor(sym) { return `avgmeta:${sym}`; }

function loadMeta(sym) {
  try {
    const raw = localStorage.getItem(keyFor(sym));
    if (!raw) return { avg: null, size: null };
    return JSON.parse(raw);
  } catch { return { avg: null, size: null }; }
}

function saveMeta(sym, avg, size) {
  localStorage.setItem(keyFor(sym), JSON.stringify({ avg, size }));
}

function applyMetaToUI(meta) {
  elAvgPrice.value = meta.avg ?? '';
  elSize.value = meta.size ?? '';
  elAvgView.textContent = meta.avg ? fmt(meta.avg, 6) : '-';
  elSizeView.textContent = meta.size ? fmt(meta.size, 6) : '-';
}

function updatePnl(last, avg, size) {
  if (!last || !avg || !size) {
    elPnl.textContent = '-';
    elRoe.textContent = '-';
    return;
  }
  const pnl = (last - avg) * size;
  const roe = ((last - avg) / avg) * 100;
  elPnl.textContent = `${pnl >= 0 ? '+' : ''}${fmt(pnl, 6)}`;
  elPnl.style.color = pnl >= 0 ? '#18b26b' : '#ff5d5d';
  elRoe.textContent = `${roe >= 0 ? '+' : ''}${fmt(roe, 2)}%`;
  elRoe.style.color = roe >= 0 ? '#18b26b' : '#ff5d5d';
}

async function fetchKlines(symbol, limit = DEFAULT_LIMIT) {
  const url = `${API}?symbol=${symbol}&interval=${INTERVAL}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Binance API 에러');
  const raw = await res.json();
  // Map into LightweightCharts format
  const data = raw.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
  return data;
}

function setActiveRangeBtn(btn) {
  rangeBtns.forEach(b => b.classList.toggle('active', b === btn));
}

async function render(symbol, limit) {
  try {
    const data = await fetchKlines(symbol, limit);
    candleSeries.setData(data);
    const last = data[data.length - 1]?.close ?? null;

    elLast.textContent = last ? fmt(last, 6) : '-';

    // Last price line
    if (lastLine) candleSeries.removePriceLine(lastLine);
    if (elShowLastLine.checked && last) {
      lastLine = candleSeries.createPriceLine({
        price: last,
        color: '#6b7280',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Last: ${fmt(last, 6)}`,
      });
    }

    // Avg line
    const meta = loadMeta(symbol);
    if (avgLine) candleSeries.removePriceLine(avgLine);
    if (meta.avg && elShowAvgLabel.checked) {
      avgLine = candleSeries.createPriceLine({
        price: Number(meta.avg),
        color: '#2a6df4',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `Avg: ${fmt(meta.avg, 6)}`,
      });
    }

    updatePnl(last, Number(meta.avg), Number(meta.size));
  } catch (e) {
    console.error(e);
    alert('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

// ---- Events ----
elRefresh.addEventListener('click', () => render(elSymbol.value, currentLimit));
elSymbol.addEventListener('change', () => {
  const meta = loadMeta(elSymbol.value);
  applyMetaToUI(meta);
  render(elSymbol.value, currentLimit);
});

elSave.addEventListener('click', () => {
  const avg = Number(elAvgPrice.value || 0);
  const size = Number(elSize.value || 0);
  saveMeta(elSymbol.value, avg || null, size || null);
  applyMetaToUI({ avg: avg || null, size: size || null });
  render(elSymbol.value, currentLimit);
});

elClear.addEventListener('click', () => {
  localStorage.removeItem(keyFor(elSymbol.value));
  applyMetaToUI({ avg: null, size: null });
  render(elSymbol.value, currentLimit);
});

elShowAvgLabel.addEventListener('change', () => render(elSymbol.value, currentLimit));
elShowLastLine.addEventListener('change', () => render(elSymbol.value, currentLimit));

let currentLimit = DEFAULT_LIMIT;
rangeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentLimit = Number(btn.dataset.limit);
    setActiveRangeBtn(btn);
    render(elSymbol.value, currentLimit);
  });
});

// ---- Init ----
(function init() {
  const meta = loadMeta(elSymbol.value);
  applyMetaToUI(meta);
  setActiveRangeBtn(document.querySelector('.range-buttons button.active') || rangeBtns[1]);
  render(elSymbol.value, currentLimit);
})();
