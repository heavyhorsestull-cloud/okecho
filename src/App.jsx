import { useState, useMemo, useCallback } from 'react'
import { BookOpen, ArrowRight, History, ChevronDown } from 'lucide-react'
import { TANK_DATA } from './data/tankdata'

/* ─── データユーティリティ ─── */

const TANK_NOS = Object.keys(TANK_DATA).sort((a, b) => Number(a) - Number(b))

// タンク41～79は同一データのため1つにまとめる
const DISPLAY_OPTIONS = (() => {
  const opts = []
  let added = false
  for (const no of TANK_NOS) {
    const n = Number(no)
    if (n >= 41 && n <= 79) {
      if (!added) { opts.push({ value: '41', label: '41 ～ 79' }); added = true }
    } else {
      opts.push({ value: no, label: no })
    }
  }
  return opts
})()

// タンク番号の表示ラベル
function tankLabel(no) {
  const n = Number(no)
  return (n >= 41 && n <= 79) ? '41 ～ 79' : no
}

function getTankInfo(no) {
  const data = TANK_DATA[no]
  const keys = Object.keys(data).map(Number).sort((a, b) => a - b)
  return {
    maxLiter:  data[String(keys[0])],
    maxKujaku: keys[keys.length - 1],
  }
}

function kujakuToLiter(no, mm) {
  const rounded = Math.round(mm / 2) * 2
  const liter   = TANK_DATA[no][String(rounded)]
  if (liter == null) return { ok: false }
  return { ok: true, liter, rounded, wasRounded: rounded !== mm }
}

function literToKujaku(no, targetL) {
  const entries = Object.entries(TANK_DATA[no])
    .map(([k, v]) => ({ kujaku: Number(k), liter: v }))
    .sort((a, b) => a.kujaku - b.kujaku)

  const exact = entries.find(e => e.liter === targetL)
  if (exact) return { ok: true, kujaku: exact.kujaku, exact: true }

  let best = null, bestDiff = Infinity
  for (const e of entries) {
    const d = Math.abs(e.liter - targetL)
    if (d < bestDiff) { bestDiff = d; best = e }
  }
  return best
    ? { ok: true, kujaku: best.kujaku, nearestLiter: best.liter, exact: false }
    : { ok: false }
}

/* ─── サブコンポーネント ─── */

function TankGauge({ percent }) {
  const pct = Math.min(Math.max(percent, 0), 100)
  return (
    <div className="mt-4 space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-400">
        <span>空</span>
        <span className="text-indigo-500 font-semibold">{pct.toFixed(1)}%</span>
        <span>満</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-400 to-sky-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ResultCard({ result, maxLiter }) {
  if (!result) return null

  const percent = result.ok && maxLiter ? (result.displayLiter / maxLiter) * 100 : 0

  return (
    <div className={`rounded-2xl p-5 transition-all duration-300 ${
      result.ok
        ? 'bg-indigo-50 border border-indigo-100'
        : 'bg-red-50 border border-red-100'
    }`}>
      {result.ok ? (
        <>
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-1">結果</p>
          <div className="flex items-end gap-1.5">
            <span className="text-5xl font-extrabold tracking-tight text-indigo-700 leading-none">
              {result.displayValue.toLocaleString()}
            </span>
            <span className="text-xl font-semibold text-indigo-400 mb-0.5">{result.unit}</span>
          </div>
          {result.note && (
            <p className="mt-2 text-xs text-slate-400">{result.note}</p>
          )}
          <TankGauge percent={percent} />
        </>
      ) : (
        <p className="text-red-500 font-medium text-sm">{result.message}</p>
      )}
    </div>
  )
}

function HistoryItem({ item }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
      <span className="shrink-0 text-xs font-bold text-white bg-indigo-400 rounded-lg px-2 py-0.5">
        #{tankLabel(item.tankNo)}
      </span>
      <span className="text-sm text-slate-600 flex items-center gap-1.5">
        {item.type === 'kujaku' ? (
          <>
            <span className="font-medium">{item.input} mm</span>
            <ArrowRight size={12} className="text-slate-300" />
            <span className="font-bold text-indigo-600">{item.liter.toLocaleString()} L</span>
          </>
        ) : (
          <>
            <span className="font-medium">{item.input.toLocaleString()} L</span>
            <ArrowRight size={12} className="text-slate-300" />
            <span className="font-bold text-indigo-600">{item.kujaku} mm</span>
          </>
        )}
      </span>
    </div>
  )
}

/* ─── メインApp ─── */

export default function App() {
  const [tankNo,    setTankNo]    = useState(TANK_NOS[0])
  const [tab,       setTab]       = useState('kujaku')
  const [kujakuVal, setKujakuVal] = useState('')
  const [literVal,  setLiterVal]  = useState('')
  const [result,    setResult]    = useState(null)
  const [history,   setHistory]   = useState([])

  const tankInfo = useMemo(() => getTankInfo(tankNo), [tankNo])

  const handleTankChange = (no) => { setTankNo(no); setResult(null) }
  const handleTabChange  = (t)  => { setTab(t);     setResult(null) }

  const handleConvert = useCallback(() => {
    if (tab === 'kujaku') {
      const mm = parseInt(kujakuVal, 10)
      if (isNaN(mm) || mm < 0) return
      const res = kujakuToLiter(tankNo, mm)
      if (res.ok) {
        const note = res.wasRounded ? `※ ${mm}mm → ${res.rounded}mm に丸めました` : null
        setResult({ ok: true, displayValue: res.liter, displayLiter: res.liter, unit: 'L', note })
        setHistory(h => [{ type: 'kujaku', tankNo, input: mm, liter: res.liter }, ...h].slice(0, 5))
      } else {
        setResult({ ok: false, message: `データ範囲外です（最大空尺: ${tankInfo.maxKujaku} mm）` })
      }
    } else {
      const liter = parseInt(literVal, 10)
      if (isNaN(liter) || liter < 0) return
      const res = literToKujaku(tankNo, liter)
      if (res.ok) {
        const note = !res.exact ? `※ 完全一致なし。最近傍 ${res.nearestLiter?.toLocaleString()} L に対応` : null
        setResult({ ok: true, displayValue: res.kujaku, displayLiter: liter, unit: 'mm', note })
        setHistory(h => [{ type: 'liter', tankNo, input: liter, kujaku: res.kujaku }, ...h].slice(0, 5))
      } else {
        setResult({ ok: false, message: '該当データがありません' })
      }
    }
  }, [tab, tankNo, kujakuVal, literVal, tankInfo])

  const currentInput = tab === 'kujaku' ? kujakuVal : literVal
  const setCurrentInput = tab === 'kujaku' ? setKujakuVal : setLiterVal

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex flex-col items-center px-4 py-10 pb-16">

      {/* ヘッダー */}
      <header className="mb-8 flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <BookOpen size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">桶帳ツール</h1>
      </header>

      {/* メインカード */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-indigo-100/60 border border-slate-100 overflow-hidden">

        {/* タンク選択 */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            タンク No.
          </label>
          <div className="relative">
            <select
              value={tankNo}
              onChange={e => handleTankChange(e.target.value)}
              className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-semibold text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition appearance-none cursor-pointer"
            >
              {DISPLAY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <p className="mt-2.5 text-xs text-slate-400 text-right">
            満タン容量：<span className="font-bold text-slate-600">{tankInfo.maxLiter.toLocaleString()} L</span>
          </p>
        </div>

        {/* タブ */}
        <div className="flex border-b border-slate-100">
          {[
            { key: 'kujaku', label: '空尺 → リットル' },
            { key: 'liter',  label: 'リットル → 空尺' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-150 border-b-2 ${
                tab === key
                  ? 'text-indigo-600 border-indigo-500'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* フォーム */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              {tab === 'kujaku' ? '空尺 (mm)' : 'リットル (L)'}
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder=""
              value={currentInput}
              onChange={e => { setCurrentInput(e.target.value); setResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleConvert()}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          <button
            onClick={handleConvert}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] text-white font-bold rounded-xl text-base transition-all duration-150 shadow-lg shadow-indigo-200"
          >
            変換する
          </button>

          {result && <ResultCard result={result} maxLiter={tankInfo.maxLiter} />}
        </div>
      </div>

      {/* 変換履歴 */}
      {history.length > 0 && (
        <div className="w-full max-w-sm mt-5 bg-white rounded-2xl shadow shadow-slate-100/80 border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <History size={14} className="text-slate-400" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">変換履歴</h2>
          </div>
          <div className="py-1.5">
            {history.map((item, i) => (
              <HistoryItem key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
