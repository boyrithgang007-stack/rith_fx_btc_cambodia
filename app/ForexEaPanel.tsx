"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ControlButton from "./ControlButton";
import type { ForexCondition, ForexIndicatorName, ForexOperand, ForexOperator, ForexRule } from "./lib/ea/forex-rules";

type SavedStrategy = { id: string; name: string; rule: ForexRule; isTemplate: boolean; updatedAt: string };
type Mt5Connection = { id: string; provider: string; label: string };
type SignalResult = {
  action: "BUY" | "SELL" | "WAIT";
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  reason: string;
  candleTime: number | null;
};
const indicators: { value: ForexIndicatorName | "number"; label: string }[] = [
  { value: "close", label: "Close price" }, { value: "ema", label: "EMA" },
  { value: "rsi", label: "RSI" }, { value: "atr", label: "ATR" }, { value: "number", label: "Fixed value" },
];
const operators: { value: ForexOperator; label: string }[] = [
  { value: "above", label: "is above" }, { value: "below", label: "is below" },
  { value: "crosses_above", label: "crosses above" }, { value: "crosses_below", label: "crosses below" },
];

function defaultCondition(operator: ForexOperator = "above"): ForexCondition {
  return { left: { indicator: "close" }, operator, right: { indicator: "ema", period: 20 } };
}

function operandKind(operand: ForexOperand) {
  return "value" in operand ? "number" : operand.indicator;
}

function FormulaCondition({ value, onChange, onRemove }: {
  value: ForexCondition;
  onChange: (condition: ForexCondition) => void;
  onRemove: () => void;
}) {
  const setOperand = (side: "left" | "right", kind: string) => {
    const operand: ForexOperand = kind === "number" ? { value: 50 }
      : kind === "close" ? { indicator: "close" }
        : { indicator: kind as ForexIndicatorName, period: kind === "rsi" ? 14 : 20 };
    onChange({ ...value, [side]: operand });
  };
  const renderOperand = (side: "left" | "right", operand: ForexOperand) => (
    <span className="forex-rule-operand">
      <select aria-label={`${side} indicator`} value={operandKind(operand)} onChange={event => setOperand(side, event.target.value)}>
        {indicators.map(indicator => <option key={indicator.value} value={indicator.value}>{indicator.label}</option>)}
      </select>
      {"value" in operand
        ? <input aria-label={`${side} fixed value`} type="number" step="any" value={operand.value}
            onChange={event => onChange({ ...value, [side]: { value: Number(event.target.value) } })} />
        : operand.indicator !== "close" && <input aria-label={`${side} period`} type="number" min={2} max={100}
            value={operand.period} onChange={event => onChange({ ...value, [side]: { ...operand, period: Number(event.target.value) } })} />}
    </span>
  );
  return <div className="forex-rule-condition">
    {renderOperand("left", value.left)}
    <select aria-label="Comparison" value={value.operator} onChange={event => onChange({ ...value, operator: event.target.value as ForexOperator })}>
      {operators.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
    </select>
    {renderOperand("right", value.right)}
    <ControlButton type="button" className="watchlist-filter" onClick={onRemove} aria-label="Remove condition">Remove</ControlButton>
  </div>;
}

export default function ForexEaPanel({ isAdmin }: { isAdmin: boolean }) {
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [connections, setConnections] = useState<Mt5Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [signals, setSignals] = useState<Record<string, SignalResult>>({});
  const [name, setName] = useState("My Forex Strategy");
  const [symbol, setSymbol] = useState<ForexRule["symbol"]>("EURUSD");
  const [stopAtr, setStopAtr] = useState(1.5);
  const [buy, setBuy] = useState<ForexCondition[]>([
    { left: { indicator: "close" }, operator: "crosses_above", right: { indicator: "ema", period: 20 } },
    { left: { indicator: "rsi", period: 14 }, operator: "above", right: { value: 50 } },
  ]);
  const [sell, setSell] = useState<ForexCondition[]>([
    { left: { indicator: "close" }, operator: "crosses_below", right: { indicator: "ema", period: 20 } },
    { left: { indicator: "rsi", period: 14 }, operator: "below", right: { value: 50 } },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishTemplate, setPublishTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/ea/forex/strategies", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "មិនអាចទាញ Forex strategies បានទេ។");
      setStrategies(data.strategies);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចទាញ Forex strategies បានទេ។");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/ea/forex/strategies", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "មិនអាចទាញ Forex strategies បានទេ។");
        return data;
      })
      .then(data => { if (active) setStrategies(data.strategies); })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "មិនអាចទាញ Forex strategies បានទេ។");
      });
    fetch("/api/connections", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "មិនអាចទាញ MT5 accounts បានទេ។");
        return data;
      })
      .then(data => {
        if (!active) return;
        const mt5Connections = (data.connections as Mt5Connection[]).filter(connection => connection.provider === "mt5");
        setConnections(mt5Connections);
        setSelectedConnection(current => current || mt5Connections[0]?.id || "");
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "មិនអាចទាញ MT5 accounts បានទេ។");
      });
    return () => { active = false; };
  }, []);

  const formRule = (): ForexRule => ({ name: name.trim(), symbol, timeframe: "15m", higherTimeframe: "1h", buy, sell, stopAtr });
  const reset = () => {
    setEditingId(null);
    setPublishTemplate(false);
    setName("My Forex Strategy");
    setSymbol("EURUSD");
    setStopAtr(1.5);
    setBuy([
      { left: { indicator: "close" }, operator: "crosses_above", right: { indicator: "ema", period: 20 } },
      { left: { indicator: "rsi", period: 14 }, operator: "above", right: { value: 50 } },
    ]);
    setSell([
      { left: { indicator: "close" }, operator: "crosses_below", right: { indicator: "ema", period: 20 } },
      { left: { indicator: "rsi", period: 14 }, operator: "below", right: { value: 50 } },
    ]);
  };
  const edit = (strategy: SavedStrategy, clone: boolean) => {
    setEditingId(clone ? null : strategy.id);
    setPublishTemplate(strategy.isTemplate && !clone);
    setName(clone ? `${strategy.name} (copy)` : strategy.name);
    setSymbol(strategy.rule.symbol);
    setStopAtr(strategy.rule.stopAtr);
    setBuy(strategy.rule.buy);
    setSell(strategy.rule.sell);
    setMessage(clone ? "Template ត្រូវបានចម្លងជាទម្រង់ផ្ទាល់ខ្លួន។" : "");
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ea/forex/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId ?? undefined, publishTemplate, rule: formRule() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "មិនអាចរក្សាទុក Forex strategy បានទេ។");
      setMessage(`បានរក្សាទុក ${data.strategy.name}។`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចរក្សាទុក Forex strategy បានទេ។");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ea/forex/strategies", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "មិនអាចលុប Forex strategy បានទេ។");
      if (editingId === id) reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចលុប Forex strategy បានទេ។");
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (strategyId: string) => {
    if (!selectedConnection) {
      setError("សូមភ្ជាប់ Exness MT5 investor account នៅផ្នែក Connections ជាមុន។");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ea/forex/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, connectionId: selectedConnection }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "មិនអាចវិភាគ Forex signal បានទេ។");
      setSignals(previous => ({ ...previous, [strategyId]: data.signal }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចវិភាគ Forex signal បានទេ។");
    } finally {
      setBusy(false);
    }
  };

  const group = (title: string, conditions: ForexCondition[], update: (conditions: ForexCondition[]) => void, operator: ForexOperator) => (
    <fieldset className="forex-rule-group">
      <legend>{title} <small>(លក្ខខណ្ឌទាំងអស់ត្រូវបំពេញ)</small></legend>
      {conditions.map((condition, index) => <FormulaCondition key={`${title}-${index}`} value={condition}
        onChange={next => update(conditions.map((item, current) => current === index ? next : item))}
        onRemove={() => update(conditions.filter((_, current) => current !== index))} />)}
      <ControlButton type="button" className="watchlist-filter" disabled={conditions.length >= 10}
        onClick={() => update([...conditions, defaultCondition(operator)])}>+ Add condition</ControlButton>
    </fieldset>
  );

  return <section className="ea-bot forex-ea-panel" aria-labelledby="forex-ea-title">
    <div className="ea-bot-heading"><div><p className="eyebrow">FOREX EA · RULE BUILDER</p><h3 id="forex-ea-title">បង្កើតរូបមន្ត Forex</h3></div><span className="ea-state">FORMULA ONLY</span></div>
    <p className="ea-bot-notice">រូបមន្តនេះបង្កើត signal លើ candle MT5 15 នាទីដែលបានបិទប៉ុណ្ណោះ។ Forex EA/ការដាក់ order នៅ Demo មិនទាន់បើកទេ៖ MT5 bridge បច្ចុប្បន្នជា read-only និងមិនដាក់ order។ គ្មានការភ្ជាប់ live account នៅទីនេះទេ។</p>
    <form onSubmit={save}>
      <div className="ea-fields forex-rule-fields">
        <label>Strategy name<input maxLength={60} required value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Symbol<select value={symbol} onChange={event => setSymbol(event.target.value as ForexRule["symbol"])}>
          <option value="EURUSD">EURUSD</option><option value="GBPUSD">GBPUSD</option><option value="USDJPY">USDJPY</option><option value="XAUUSD">XAUUSD</option>
        </select></label>
        <label>Timeframe<input value="15m + 1h trend filter" readOnly /></label>
        <label>Stop distance (ATR ×)<input type="number" min={0.5} max={5} step={0.1} value={stopAtr}
          onChange={event => setStopAtr(Number(event.target.value))} /></label>
      </div>
      {group("BUY when", buy, setBuy, "above")}
      {group("SELL when", sell, setSell, "below")}
      <p className="forex-rule-risk">សញ្ញា BUY ត្រូវ Close 1h លើ EMA20 និង SELL ត្រូវ Close 1h ក្រោម EMA20។ TP ប្រើ 2R។ ការកំណត់សម្រាប់ Demo ដែលបានគ្រោងទុក៖ risk មិនលើស 1%/order · leverage មិនលើស 5× · បញ្ឈប់នៅពេលខាតប្រចាំថ្ងៃដល់ 3%។</p>
      {isAdmin && <label className="ea-toggle forex-template-toggle"><input type="checkbox" checked={publishTemplate}
        onChange={event => setPublishTemplate(event.target.checked)} /> Publish as shared admin template</label>}
      <div className="ea-footer"><div>
        <ControlButton type="submit" disabled={busy || !buy.length || !sell.length}>{busy ? "Saving…" : editingId ? "Update strategy" : "Save strategy"}</ControlButton>
        {editingId && <ControlButton type="button" className="watchlist-filter" onClick={reset}>Cancel edit</ControlButton>}
      </div></div>
      {message && <p className="ea-message" role="status">{message}</p>}
      {error && <p className="ea-message ea-error" role="alert">{error}</p>}
    </form>
    <div className="ea-runs forex-strategy-list"><h4>My strategies and admin templates</h4>
      <label className="forex-connection-picker">MT5 investor account
        <select value={selectedConnection} onChange={event => setSelectedConnection(event.target.value)} disabled={!connections.length}>
          {!connections.length && <option value="">មិនមាន MT5 account ភ្ជាប់</option>}
          {connections.map(connection => <option key={connection.id} value={connection.id}>{connection.label}</option>)}
        </select>
        {!connections.length && <small><Link href="/accounts/mt5">ភ្ជាប់ Exness MT5 investor account</Link> (read-only)</small>}
      </label>
      {!strategies.length ? <p>មិនទាន់មាន strategy ទេ។</p> : <ul>{strategies.map(strategy => <li key={strategy.id}>
        <strong>{strategy.name} · {strategy.rule.symbol} · 15m {strategy.isTemplate ? "· ADMIN TEMPLATE" : ""}</strong>
        <small>BUY {strategy.rule.buy.length} conditions · SELL {strategy.rule.sell.length} conditions · ATR × {strategy.rule.stopAtr}</small>
        {signals[strategy.id] && <div className="forex-signal-output">
          <strong className={`forex-signal-${signals[strategy.id].action.toLowerCase()}`}>{signals[strategy.id].action}</strong>
          <span>{signals[strategy.id].reason}</span>
          {signals[strategy.id].entry !== null && <small>Entry {signals[strategy.id].entry} · SL {signals[strategy.id].stopLoss} · TP {signals[strategy.id].takeProfit}</small>}
          {signals[strategy.id].candleTime && <small>15m close: {new Date(signals[strategy.id].candleTime!).toLocaleString()}</small>}
        </div>}
        <div className="ea-footer"><div>
          <ControlButton type="button" className="watchlist-filter" onClick={() => edit(strategy, strategy.isTemplate && !isAdmin)}>{strategy.isTemplate && !isAdmin ? "Use template" : "Edit"}</ControlButton>
          <ControlButton type="button" className="watchlist-filter" disabled={busy || !connections.length} onClick={() => void analyze(strategy.id)}>Analyze MT5 candles</ControlButton>
          {(!strategy.isTemplate || isAdmin) && <ControlButton type="button" className="watchlist-filter" disabled={busy} onClick={() => void remove(strategy.id)}>Delete</ControlButton>}
        </div></div>
      </li>)}</ul>}
    </div>
  </section>;
}
