import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";

const KRW = new Intl.NumberFormat("ko-KR");
const ETH_BASE = 3_500_000;
function rand(min, max) { return Math.random() * (max - min) + min; }
function randomWalk(len, start, drift = 0, vol = 0.02) {
  const arr = []; let v = start;
  for (let i = 0; i < len; i++) { const shock = (Math.random() - 0.5) * 2 * vol * v; v = Math.max(10, v + drift * v + shock); arr.push({ i, v: Math.round(v) }); }
  return arr;
}
const PRESETS = [{id:"BTC",name:"비트코인"},{id:"ETH",name:"이더리움"},{id:"XRP",name:"리플"},{id:"SOL",name:"솔라나"},{id:"ADA",name:"에이다"},{id:"DOGE",name:"도지코인"}];
function makeInitialAssets(btcPrice = 160_000_000) {
  return PRESETS.map((p) => {
    const base = p.id === "BTC" ? btcPrice : p.id === "ETH" ? ETH_BASE : rand(600_000, 80_000_000);
    const data = randomWalk(40, base, rand(-0.0005, 0.0008), 0.018);
    const last = data[data.length - 1].v; const first = data[0].v; const change = ((last - first) / first) * 100;
    return { id: p.id, name: p.name, price: last, change, volume: Math.floor(rand(2, 200))*1_000_000_000, data, lastPrice: last, starred: ["BTC","ETH"].includes(p.id) };
  });
}
function useUpbitTicker(onPrice, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const ws = new WebSocket("wss://api.upbit.com/websocket/v1");
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      const req = [ { ticket: "marketx" }, { type: "ticker", codes: ["KRW-BTC","KRW-ETH","KRW-XRP","KRW-SOL","KRW-ADA","KRW-DOGE"], isOnlyRealtime: true }, { format: "DEFAULT" } ];
      ws.send(JSON.stringify(req));
    };
    ws.onmessage = async (ev) => {
      try {
        const buf = ev.data instanceof ArrayBuffer ? ev.data : await ev.data.arrayBuffer?.();
        const msg = JSON.parse(new TextDecoder("utf-8").decode(buf ?? ev.data));
        if (msg.type === "ticker" && typeof msg.trade_price === "number") {
          const id = (msg.code || "-").split("-")[1];
          onPrice(id, Math.round(msg.trade_price));
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [onPrice, enabled]);
}
function useMockTicker(setAssets, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      setAssets((old) => old.map((a) => {
        const prev = a.price;
        const next = Math.max(10, prev + (Math.random() - 0.5) * prev * 0.002);
        const point = { i: (a.data[a.data.length - 1]?.i ?? 0) + 1, v: Math.round(next) };
        const data = [...a.data.slice(-39), point];
        const first = data[0].v; const change = ((point.v - first) / first) * 100;
        return { ...a, price: point.v, data, change, lastPrice: prev };
      }));
    }, 1500);
    return () => clearInterval(t);
  }, [setAssets, enabled]);
}
const ChangePill = ({ value }) => { const up = value >= 0; return <span className={`px-2 py-1 rounded-full text-xs font-semibold tabular-nums ${up?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"}`}>{up?"+":""}{value.toFixed(2)}%</span>; };
const Spark = ({ data, up }) => (<div className="w-24 h-8"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}><YAxis hide domain={["auto","auto"]} /><Tooltip content={() => null} /><Line type="monotone" dataKey="v" dot={false} stroke={up?"#10b981":"#ef4444"} strokeWidth={1.6} /></LineChart></ResponsiveContainer></div>);
const PriceCell = ({ price, prev }) => { const up = price >= prev; return (<motion.div initial={false} animate={{ backgroundColor: up?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)" }} transition={{ duration: 0.25 }} className="px-2 py-0.5 rounded-md inline-block"><span className="tabular-nums font-semibold">₩ {KRW.format(price)}</span></motion.div>); };
const Row = ({ a, onSelect, onStar }) => { const up = a.change >= 0; return (<motion.button onClick={onSelect} whileTap={{ scale: 0.98 }} className="w-full grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-3 rounded-2xl bg-white hover:bg-white border border-gray-200">
  <div className="flex items-center gap-3 text-left">
    <div className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-white" style={{ background: up?"#10b981":"#ef4444" }}>{a.id.slice(0,3)}</div>
    <div><div className="text-[15px] font-semibold leading-tight">{a.name}</div><div className="text-xs text-gray-500">{a.id}</div></div>
  </div>
  <Spark data={a.data} up={up} />
  <div className="text-right min-w-[120px]"><PriceCell price={a.price} prev={a.lastPrice} /></div>
  <div className="flex items-center gap-2 min-w-[90px] justify-end">
    <ChangePill value={a.change} />
    <button onClick={(e)=>{e.stopPropagation(); onStar();}} className="p-2 rounded-full hover:bg-black/5" title={a.starred?"관심 해제":"관심 등록"}>{a.starred ? "★" : "☆"}</button>
  </div>
</motion.button>); };

export default function App() {
  const [assets, setAssets] = useState(() => { let last = 160_000_000; try { const v = Number(localStorage.getItem('btc_last_live')); if (!Number.isNaN(v) && v>0) last = v; } catch {} return makeInitialAssets(last); });
  const [query, setQuery] = useState(""); const [sort, setSort] = useState("popular"); const [live, setLive] = useState(true);

  const handleLivePrice = (id, price) => {
    setAssets((old) => old.map((a) => {
      if (a.id !== id) return a;
      const prev = a.price; const point = { i: (a.data[a.data.length - 1]?.i ?? 0) + 1, v: price };
      const data = [...a.data.slice(-39), point]; const first = data[0].v; const change = ((price - first) / first) * 100;
      return { ...a, price, data, change, lastPrice: prev };
    })); if (id === 'BTC') try { localStorage.setItem('btc_last_live', String(price)); } catch {}
  };

  useUpbitTicker(handleLivePrice, live); useMockTicker(setAssets, !live);

  const list = useMemo(() => {
    let arr = assets;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    }
    const favs = arr.filter((a) => a.starred);
    const rest = arr.filter((a) => !a.starred);
    const sortBy = (xs) => {
      switch (sort) {
        case "price": return [...xs].sort((a,b)=>b.price-a.price);
        case "change": return [...xs].sort((a,b)=>b.change-a.change);
        case "volume": return [...xs].sort((a,b)=>b.volume-a.volume);
        default: return xs;
      }
    };
    return [...sortBy(favs), ...sortBy(rest)];
  }, [assets, query, sort]);

  const toggleStar = (id) => setAssets((old) => old.map((a) => (a.id === id ? { ...a, starred: !a.starred } : a)));

  return (<div className="min-h-[100dvh] w-full grid place-items-center bg-gradient-to-b from-gray-50 to-white text-gray-900">
    <div className="mx-auto w-full max-w-[520px] rounded-[2rem] border border-gray-200 bg-white/80 shadow-2xl backdrop-blur overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 bg-white/80 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold tracking-tight">MarketX</div>
          <label className="ml-auto flex items-center gap-2 text-xs"><input type="checkbox" checked={live} onChange={(e)=>setLive(e.target.checked)} /><span>실시간(Upbit)</span></label>
          <span className="text-xs text-gray-500">{live?"실시간 • Upbit":"데모 데이터"}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-gray-100 border border-gray-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-70"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/></svg>
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="종목명/심볼 검색" className="bg-transparent outline-none text-sm w-full" />
          </div>
          <select value={sort} onChange={(e)=>setSort(e.target.value)} className="px-3 py-2 rounded-xl bg-transparent border border-gray-300 text-sm">
            <option value="popular">정렬: 인기</option>
            <option value="price">가격</option>
            <option value="change">등락률</option>
            <option value="volume">거래대금</option>
          </select>
        </div>
      </div>
      <div className="p-3 grid gap-2"><AnimatePresence initial={false}>{list.map((a)=>(<Row key={a.id} a={a} onSelect={()=>{}} onStar={()=>toggleStar(a.id)} />))}</AnimatePresence></div>
    </div>
  </div>);
}