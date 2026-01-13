import React from "react";
import { NodeData } from "./types";

interface NodeInspectorProps {
  node: NodeData | null;
  onDataChange: (data: Record<string, unknown>) => void;
}

export function NodeInspector({ node, onDataChange }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="tradeflow-inspector">
        <div className="tradeflow-inspector-header">
          <h2>Node Inspector</h2>
        </div>
        <div className="tradeflow-inspector-content">
          <div className="text-center" style={{ color: 'rgb(107, 114, 128)', marginTop: 'var(--sp-6)' }}>Select a node to edit</div>
        </div>
      </div>
    );
  }

  const data = node.data as any;

  return (
    <div className="tradeflow-inspector">
      <div className="tradeflow-inspector-header">
        <h2>Node Inspector</h2>
        <p className="tradeflow-inspector-subtitle">
          {node.type === "and"
            ? "AND"
            : node.type === "or"
              ? "OR"
              : node.type === "market"
                ? "Market Type"
                : node.type === "profit"
                  ? "Take Profit"
                  : node.type}
        </p>
      </div>

      <div className="tradeflow-inspector-content">
        {node.type === "market" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="tradeflow-field">
              <label className="tradeflow-label">Market Type</label>
              <select
                value={data.marketType || "All"}
                onChange={(e) => onDataChange({ ...data, marketType: e.target.value })}
                className="tradeflow-select"
              >
                <option>All</option>
                <option>Sports</option>
                <option>Politics</option>
                <option>Crypto</option>
                <option>Economics</option>
              </select>
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Search Keyword</label>
              <input
                type="text"
                value={data.searchKeyword || ""}
                onChange={(e) => onDataChange({ ...data, searchKeyword: e.target.value })}
                placeholder="Optional..."
                className="tradeflow-input"
              />
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Min Liquidity ($)</label>
              <input
                type="number"
                value={data.minLiquidity || 0}
                onChange={(e) => onDataChange({ ...data, minLiquidity: Number(e.target.value) })}
                className="tradeflow-input"
              />
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Min Volume ($)</label>
              <input
                type="number"
                value={data.minVolume || 0}
                onChange={(e) => onDataChange({ ...data, minVolume: Number(e.target.value) })}
                className="tradeflow-input"
              />
            </div>
          </div>
        )}

        {(node.type === "entry" || node.type === "exit") && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="tradeflow-field">
              <label className="tradeflow-label">Field</label>
              <select
                value={data.field || "price"}
                onChange={(e) => onDataChange({ ...data, field: e.target.value })}
                className="tradeflow-select"
              >
                <option value="price">Price</option>
                <option value="spread">Spread</option>
                <option value="liquidity">Liquidity</option>
                <option value="volume_24h">24h Volume</option>
                <option value="time_until_close">Time Until Close</option>
                <option value="implied_probability">Implied Probability</option>
                {node.type === "exit" && <option value="pnl_percent">PnL %</option>}
                {node.type === "exit" && <option value="probability_threshold">Probability Threshold</option>}
              </select>
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Operator</label>
              <select
                value={data.operator || ">"}
                onChange={(e) => onDataChange({ ...data, operator: e.target.value })}
                className="tradeflow-select"
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="==">=</option>
                <option value="!=">&ne;</option>
              </select>
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Value</label>
              <input
                type="text"
                value={data.value || ""}
                onChange={(e) => onDataChange({ ...data, value: e.target.value })}
                placeholder="e.g., 0.65"
                className="tradeflow-input"
              />
            </div>

            {node.type === "exit" && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2)', background: 'rgba(55, 65, 81, 0.4)', borderRadius: 'var(--r-md)' }}>
                <input
                  type="checkbox"
                  checked={data.trailingStop || false}
                  onChange={(e) => onDataChange({ ...data, trailingStop: e.target.checked })}
                  style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)', cursor: 'pointer' }}
                />
                <label style={{ fontSize: 'var(--fs-sm)', color: 'rgb(209, 213, 219)' }}>Trailing Stop</label>
              </div>
            )}
          </div>
        )}

        {node.type === "profit" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="tradeflow-field">
              <label className="tradeflow-label">Type</label>
              <select
                value={data.type || "percentage"}
                onChange={(e) => onDataChange({ ...data, type: e.target.value })}
                className="tradeflow-select"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="threshold">Price/Probability Threshold</option>
              </select>
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Target Value</label>
              <input
                type="number"
                value={data.value || ""}
                onChange={(e) => onDataChange({ ...data, value: Number(e.target.value) })}
                placeholder={data.type === "percentage" ? "e.g., 10" : "e.g., 0.85"}
                className="tradeflow-input"
              />
            </div>

            <div className="tradeflow-field">
              <label className="tradeflow-label">Partial Profit</label>
              <select
                value={data.partial || "100%"}
                onChange={(e) => onDataChange({ ...data, partial: e.target.value })}
                className="tradeflow-select"
              >
                <option value="25%">Take 25%</option>
                <option value="50%">Take 50%</option>
                <option value="100%">Take All (100%)</option>
              </select>
            </div>
          </div>
        )}

        {(node.type === "and" || node.type === "or") && (
          <div style={{ padding: 'var(--sp-4)', background: 'rgba(55, 65, 81, 0.4)', borderRadius: 'var(--r-md)' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'rgb(209, 213, 219)' }}>
              {node.type === "and"
                ? "Connects multiple conditions with AND logic. All conditions must be true."
                : "Connects multiple conditions with OR logic. Any condition can be true."}
            </p>
          </div>
        )}

        {["add", "subtract", "multiply", "divide"].includes(node.type) && (
          <div style={{ padding: 'var(--sp-4)', background: 'rgba(55, 65, 81, 0.4)', borderRadius: 'var(--r-md)' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'rgb(209, 213, 219)' }}>
              Math operator: {node.type === "add" ? "+" : node.type === "subtract" ? "−" : node.type === "multiply" ? "×" : "÷"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
