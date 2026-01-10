import React from "react";
import { NodeData } from "./types";
import { Trash2 } from "lucide-react";

const nodeColors: Record<string, string> = {
  market: "bg-blue-900/40 border-blue-700",
  entry: "bg-green-900/40 border-green-700",
  exit: "bg-orange-900/40 border-orange-700",
  profit: "bg-purple-900/40 border-purple-700",
  and: "bg-gray-700/60 border-gray-600",
  or: "bg-gray-700/60 border-gray-600",
  add: "bg-yellow-900/40 border-yellow-700",
  subtract: "bg-yellow-900/40 border-yellow-700",
  multiply: "bg-yellow-900/40 border-yellow-700",
  divide: "bg-yellow-900/40 border-yellow-700",
};

const nodeLabels: Record<string, string> = {
  market: "Market Type",
  entry: "Entry",
  exit: "Exit",
  profit: "Take Profit",
  and: "AND",
  or: "OR",
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

interface WorkflowNodeProps {
  node: NodeData;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  highlightedInputHandle?: boolean;
}

export function WorkflowNode({
  node,
  isSelected,
  onSelect,
  onDelete,
  highlightedInputHandle = false,
}: WorkflowNodeProps) {
  const baseColor = nodeColors[node.type] || "bg-gray-800 border-gray-700";
  const label = nodeLabels[node.type] || node.type;

  let displayData = "";
  if (node.type === "market") {
    const data = node.data as any;
    displayData = data.marketType || "All";
  } else if (node.type === "entry" || node.type === "exit") {
    const data = node.data as any;
    displayData = data.field ? `${data.field}` : "";
  } else if (node.type === "profit") {
    const data = node.data as any;
    displayData = data.value ? `${data.value}%` : "";
  }

  return (
    <div
      className={`absolute w-40 rounded-lg border-2 p-4 cursor-grab active:cursor-grabbing transition-all ${baseColor} ${
        isSelected ? "ring-2 ring-white shadow-lg" : "hover:shadow-md"
      }`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        pointerEvents: "auto",
      }}
      data-node-id={node.id}
      onClick={() => onSelect(node.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-semibold text-gray-100">{label}</div>
        <button
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {displayData && <div className="text-xs text-gray-300">{displayData}</div>}
      
      {/* Input handle (left side) - solid black dot at center */}
      <div 
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full hover:bg-gray-300 transition-all cursor-crosshair shadow-lg border border-gray-600 ${
          highlightedInputHandle
            ? "bg-white scale-150 animate-pulse box-shadow: 0 0 8px rgba(255,255,255,0.8)"
            : "bg-black"
        }`}
        data-handle-type="input"
        data-node-id={node.id}
        title="Connect input"
      />
      
      {/* Output handle (right side) - solid black dot at center */}
      <div 
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-black rounded-full hover:bg-gray-300 transition-colors cursor-crosshair shadow-lg border border-gray-600"
        data-handle-type="output"
        data-node-id={node.id}
        title="Create connection"
      />
    </div>
  );
}
