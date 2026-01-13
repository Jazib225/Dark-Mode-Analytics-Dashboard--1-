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
      className={`workflow-node border-2 ${baseColor} ${isSelected ? "selected" : "hover:shadow-md"}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        pointerEvents: "auto",
      }}
      data-node-id={node.id}
      onClick={() => onSelect(node.id)}
    >
      <div className="workflow-node-header">
        <div className="workflow-node-title">{label}</div>
        <button
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="workflow-node-delete"
        >
          <Trash2 />
        </button>
      </div>
      {displayData && <div className="workflow-node-data">{displayData}</div>}

      {/* Four connection handles - top, right, bottom, left */}
      {/* Top handle */}
      <div
        className={`node-handle ${highlightedInputHandle ? "highlighted" : ""}`}
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
        data-handle-type="input"
        data-handle-id="top"
        data-node-id={node.id}
        title="Connect here"
      />

      {/* Right handle */}
      <div
        className="node-handle"
        style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
        data-handle-type="output"
        data-handle-id="right"
        data-node-id={node.id}
        title="Drag to connect"
      />

      {/* Bottom handle */}
      <div
        className="node-handle"
        style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
        data-handle-type="output"
        data-handle-id="bottom"
        data-node-id={node.id}
        title="Drag to connect"
      />

      {/* Left handle */}
      <div
        className={`node-handle ${highlightedInputHandle ? "highlighted" : ""}`}
        style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
        data-handle-type="input"
        data-handle-id="left"
        data-node-id={node.id}
        title="Connect here"
      />
    </div>
  );
}
