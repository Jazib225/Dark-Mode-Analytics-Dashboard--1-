import React from "react";
import { NodeData } from "./types";

interface NodeInspectorProps {
  node: NodeData | null;
  onDataChange: (data: Record<string, unknown>) => void;
}

export function NodeInspector({ node, onDataChange }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="w-80 bg-[#1a1a1a] border-l border-gray-800 flex flex-col h-full overflow-hidden p-4">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Node Inspector</h2>
        <div className="text-center text-gray-500 mt-8">Select a node to edit</div>
      </div>
    );
  }

  const data = node.data as any;

  return (
    <div className="w-80 bg-[#1a1a1a] border-l border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-gray-100">Node Inspector</h2>
        <p className="text-sm text-gray-500 mt-1 capitalize">
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

      <div className="flex-1 overflow-y-auto p-4">
        {node.type === "market" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Market Type</label>
              <select
                value={data.marketType || "All"}
                onChange={(e) => onDataChange({ ...data, marketType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              >
                <option>All</option>
                <option>Sports</option>
                <option>Politics</option>
                <option>Crypto</option>
                <option>Economics</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search Keyword</label>
              <input
                type="text"
                value={data.searchKeyword || ""}
                onChange={(e) => onDataChange({ ...data, searchKeyword: e.target.value })}
                placeholder="Optional..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Liquidity ($)</label>
              <input
                type="number"
                value={data.minLiquidity || 0}
                onChange={(e) => onDataChange({ ...data, minLiquidity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Volume ($)</label>
              <input
                type="number"
                value={data.minVolume || 0}
                onChange={(e) => onDataChange({ ...data, minVolume: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        )}

        {(node.type === "entry" || node.type === "exit") && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Field</label>
              <select
                value={data.field || "price"}
                onChange={(e) => onDataChange({ ...data, field: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Operator</label>
              <select
                value={data.operator || ">"}
                onChange={(e) => onDataChange({ ...data, operator: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="==">=</option>
                <option value="!=">&ne;</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Value</label>
              <input
                type="text"
                value={data.value || ""}
                onChange={(e) => onDataChange({ ...data, value: e.target.value })}
                placeholder="e.g., 0.65"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            {node.type === "exit" && (
              <div className="flex items-center gap-2 p-2 bg-gray-800/40 rounded-lg">
                <input
                  type="checkbox"
                  checked={data.trailingStop || false}
                  onChange={(e) => onDataChange({ ...data, trailingStop: e.target.checked })}
                  className="w-4 h-4 cursor-pointer"
                />
                <label className="text-sm text-gray-300">Trailing Stop</label>
              </div>
            )}
          </div>
        )}

        {node.type === "profit" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <select
                value={data.type || "percentage"}
                onChange={(e) => onDataChange({ ...data, type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="threshold">Price/Probability Threshold</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target Value</label>
              <input
                type="number"
                value={data.value || ""}
                onChange={(e) => onDataChange({ ...data, value: Number(e.target.value) })}
                placeholder={data.type === "percentage" ? "e.g., 10" : "e.g., 0.85"}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Partial Profit</label>
              <select
                value={data.partial || "100%"}
                onChange={(e) => onDataChange({ ...data, partial: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-600"
              >
                <option value="25%">Take 25%</option>
                <option value="50%">Take 50%</option>
                <option value="100%">Take All (100%)</option>
              </select>
            </div>
          </div>
        )}

        {(node.type === "and" || node.type === "or") && (
          <div className="p-4 bg-gray-800/40 rounded-lg">
            <p className="text-sm text-gray-300">
              {node.type === "and"
                ? "Connects multiple conditions with AND logic. All conditions must be true."
                : "Connects multiple conditions with OR logic. Any condition can be true."}
            </p>
          </div>
        )}

        {["add", "subtract", "multiply", "divide"].includes(node.type) && (
          <div className="p-4 bg-gray-800/40 rounded-lg">
            <p className="text-sm text-gray-300">
              Math operator: {node.type === "add" ? "+" : node.type === "subtract" ? "−" : node.type === "multiply" ? "×" : "÷"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
