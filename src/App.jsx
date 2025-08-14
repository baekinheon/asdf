import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";

const KRW = new Intl.NumberFormat("ko-KR");
function krw(n){ return `₩ ${KRW.format(Math.round(n||0))}`; }
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

// WebSocket + 1s REST fallback
function useUpbitRealtime(onPrice, enabled) {
  const lastTick = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let ws; let alive = true;
    const connect = () => {
      try {
        ws = new WebSocket("wss://api.upbit.com/websocket/v1");
        ws.binaryType = "arraybuffer";
        ws.onopen = () => {
          const req = [ { ticket: "marketx" }, { type: "ticker", codes: ["KRW-BTC","KRW-ETH","KRW-XRP","KRW-SOL","KRW-ADA","KRW-DOGE"] }, { format: "DEFAULT" } ];
          ws.send(JSON.stringify(req));
        };
        ws.onmessage = async (ev) => {
          try {
            const buf = ev.data instanceof ArrayBuffer ? ev.data : await ev.data.arrayBuffer?.();
            const msg = JSON.parse(new TextDecoder("utf-8").decode(buf ?? ev.data));
            if (msg.type === "ticker" && typeof msg.trade_price === "number") {
              const id = (msg.code || "-").split("-")[1];
              onPrice(id, Math.round(msg.trade_price));
              lastTick.current = Date.now();
            }
          } catch {}
        };
        ws.onerror = () => { try{ ws.close(); }catch{} };
        ws.onclose = () => { if(alive) setTimeout(connect, 1000); };
      } catch {}
    };
    connect();
    const poll = setInterval(async () => {
      if (!alive) return;
      const tooQuiet = Date.now() - lastTick.current > 1500;
      if (tooQuiet) {
        try {
          const res = await fetch("https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-ADA,KRW-DOGE", { cache:"no-store" });
          const json = await res.json();
          json.forEach((t)=>{
            const id = (t.market||"KRW-?").split("-")[1];
            if (typeof t.trade_price === "number") onPrice(id, Math.round(t.trade_price));
          });
          lastTick.current = Date.now();
        } catch {}
      }
    }, 1000);
    return () => { alive = false; clearInterval(poll); try { ws && ws.close(); } catch {} };
  }, [onPrice, enabled]);
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

function useLocalState(key, initial){
  const [v,setV] = useState(()=>{ try{ const x = JSON.parse(localStorage.getItem(key)); return x??initial; }catch{return initial;} });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(v)); }catch{} },[key,v]);
  return [v,setV];
}

function AssetsTab({assets}){
  const [cash, setCash] = useLocalState("cash_krw", 5_000_000);
  const [holdings, setHoldings] = useLocalState("holdings", [
    { id:"BTC", name:"비트코인", avg: 100_000_000, qty: 0.3 },
  ]);
  const getPrice = (id)=> assets.find(a=>a.id===id)?.price ?? 0;
  const rows = holdings.map(h=>{
    const price = getPrice(h.id);
    const cost = h.avg * h.qty;
    const value = price * h.qty;
    const pnl = value - cost;
    const pnlRate = h.avg? (price - h.avg)/h.avg*100 : 0;
    return {...h, price, cost, value, pnl, pnlRate};
  });
  const totalCost = rows.reduce((s,r)=>s+r.cost,0);
  const totalValue = rows.reduce((s,r)=>s+r.value,0);
  const totalPnl = totalValue - totalCost;
  const totalEval = cash + totalValue;
  const changeClass = (n)=> n>=0? "text-emerald-600" : "text-rose-600";

  const addBTCQuick = ()=> setHoldings((xs)=> xs.some(x=>x.id==="BTC")? xs : [...xs, {id:"BTC",name:"비트코인",avg:100_000_000,qty:0.3}]);
  const addETHQuick = ()=> setHoldings((xs)=> xs.some(x=>x.id==="ETH")? xs : [...xs, {id:"ETH",name:"이더리움",avg:3_500_000,qty:2.8571429}]);

  const update = (i, patch)=> setHoldings(xs=> xs.map((x,idx)=> idx===i? {...x, ...patch}: x));
  const remove = (i)=> setHoldings(xs=> xs.filter((_,idx)=> idx!==i));

  return (
    <div className="p-4 grid gap-4">
      <div className="rounded-2xl border border-gray-200 p-4 bg-white">
        <div className="text-sm text-gray-500">총자산 평가</div>
        <div className="mt-1 text-2xl font-extrabold">{krw(totalEval)}</div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border p-3">
            <div className="text-gray-500 text-xs">현금 (KRW)</div>
            <div className="font-semibold">{krw(cash)}</div>
            <div className="flex gap-2 mt-2">
              <button className="px-2 py-1 rounded-lg bg-gray-100" onClick={()=>setCash(cash+500_000)}>입금 +50만</button>
              <button className="px-2 py-1 rounded-lg bg-gray-100" onClick={()=>setCash(Math.max(0,cash-500_000))}>출금 -50만</button>
            </div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-gray-500 text-xs">보유 코인 평가</div>
            <div className="font-semibold">{krw(totalValue)}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-gray-500 text-xs">총 손익</div>
            <div className={`font-semibold ${changeClass(totalPnl)}`}>{krw(totalPnl)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-3 bg-white">
        <div className="flex items-center justify-between px-1">
          <div className="font-semibold">보유 코인</div>
          <div className="flex gap-2">
            <button onClick={addBTCQuick} className="px-2 py-1 rounded-lg bg-gray-100">+ BTC 추가</button>
            <button onClick={addETHQuick} className="px-2 py-1 rounded-lg bg-gray-100">+ ETH 추가</button>
          </div>
        </div>
        <div className="mt-2 grid gap-2">
          {rows.map((r, i)=> (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2 px-2 py-2 rounded-xl border">
              <div>
                <div className="text-sm font-semibold">{r.name} <span className="text-xs text-gray-500">{r.id}</span></div>
                <div className="text-xs text-gray-500">현재가 {krw(r.price)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">평단(₩)</div>
                <input className="w-24 border rounded-lg px-2 py-1 text-right text-sm" value={r.avg} onChange={(e)=>update(i,{avg:Number(e.target.value||0)})} />
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">수량</div>
                <input className="w-20 border rounded-lg px-2 py-1 text-right text-sm" value={r.qty} onChange={(e)=>update(i,{qty:Number(e.target.value||0)})} />
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">매수금</div>
                <div className="text-sm">{krw(r.cost)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">평가금</div>
                <div className="text-sm">{krw(r.value)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">손익</div>
                <div className={`text-sm ${changeClass(r.pnl)}`}>{krw(r.pnl)} <span className="text-xs">({r.pnlRate>=0?"+":""}{r.pnlRate.toFixed(2)}%)</span></div>
                <button onClick={()=>remove(i)} className="mt-1 text-xs text-gray-500 underline">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [assets, setAssets] = useState(() => { let last = 160_000_000; try { const v = Number(localStorage.getItem('btc_last_live')); if (!Number.isNaN(v) && v>0) last = v; } catch {} return makeInitialAssets(last); });
  const [query, setQuery] = useState(""); const [sort, setSort] = useState("popular"); const [tab, setTab] = useState("assets"); const [live, setLive] = useState(true);
  const handleLivePrice = (id, price) => { setAssets((old) => old.map((a) => { if (a.id !== id) return a; const prev = a.price; const point = { i: (a.data[a.data.length - 1]?.i ?? 0) + 1, v: price }; const data = [...a.data.slice(-39), point]; const first = data[0].v; const change = ((price - first) / first) * 100; return { ...a, price, data, change, lastPrice: prev }; })); };
  useUpbitRealtime(handleLivePrice, live);
  const list = useMemo(() => {
    let arr = assets; if (query.trim()) { const q = query.trim().toLowerCase(); arr = arr.filter((a)=>a.name.toLowerCase().includes(q)||a.id.toLowerCase().includes(q)); }
    const favs = arr.filter((a)=>a.starred); const rest = arr.filter((a)=>!a.starred);
    const sortBy = (xs)=>{ switch (sort) { case "price": return [...xs].sort((a,b)=>b.price-a.price); case "change": return [...xs].sort((a,b)=>b.change-a.change); case "volume": return [...xs].sort((a,b)=>b.volume-a.volume); default: return xs; } };
    return [...sortBy(favs), ...sortBy(rest)];
  }, [assets, query, sort]);
  const toggleStar = (id) => setAssets((old) => old.map((a) => (a.id === id ? { ...a, starred: !a.starred } : a)));

  return (
    <div className="min-h-[100dvh] w-full grid place-items-center bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <div className="mx-auto w-full max-w-[520px] rounded-[2rem] border border-gray-200 bg-white/80 shadow-2xl backdrop-blur overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 bg-white/80 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="text-xl font-extrabold tracking-tight">MarketX</div>
            <label className="ml-auto flex items-center gap-2 text-xs mr-3"><input type="checkbox" checked={live} onChange={(e)=>setLive(e.target.checked)} /><span>실시간(Upbit)</span></label>
            <span className="text-xs text-gray-500">{live?"실시간 • Upbit":"데이터 지연시 자동 보정"}</span>
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
          <div className="mt-3 grid grid-cols-5 gap-1 text-sm">
            <button onClick={()=>setTab("market")} className={`px-3 py-2 rounded-xl border ${tab==='market'?'bg-black text-white':'bg-white'}`}>시세</button>
            <button onClick={()=>setTab("assets")} className={`px-3 py-2 rounded-xl border ${tab==='assets'?'bg-black text-white':'bg-white'}`}>자산</button>
          </div>
        </div>

        {tab==='market' ? (
          <div className="p-3 grid gap-2">
            <AnimatePresence initial={false}>
              {list.map((a) => (<Row key={a.id} a={a} onSelect={()=>{}} onStar={()=>toggleStar(a.id)} />))}
            </AnimatePresence>
          </div>
        ) : (
          <AssetsTab assets={assets} />
        )}
      </div>
    </div>
  );
}
