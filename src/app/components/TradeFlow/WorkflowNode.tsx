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
  onDragStart: (e: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
}

export function WorkflowNode({
  node,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
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
      className={`absolute w-40 rounded-lg border-2 p-4 cursor-move transition-all ${baseColor} ${
        isSelected ? "ring-2 ring-white shadow-lg" : "hover:shadow-md"
      }`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
      }}
      onClick={() => onSelect(node.id)}
      onDragStart={(e) => onDragStart(e, node.id)}
      draggable={true}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-semibold text-gray-100">{label}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {displayData && <div className="text-xs text-gray-300">{displayData}</div>}
      {/* Input/Output ports */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-3 h-3 bg-blue-500 rounded-full" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-3 h-3 bg-blue-500 rounded-full" />
    </div>
  );
}
