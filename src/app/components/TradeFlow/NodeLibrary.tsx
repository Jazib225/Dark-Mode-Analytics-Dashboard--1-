import React, { useState } from "react";
import { Plus } from "lucide-react";

type NodeType = "market" | "entry" | "exit" | "profit" | "and" | "or" | "add" | "subtract" | "multiply" | "divide";

const stageNodes = {
  market: ["market"],
  entry: ["entry", "add", "subtract", "multiply", "divide"],
  exit: ["exit", "add", "subtract", "multiply", "divide"],
  profit: ["profit"],
  logic: ["and", "or"],
};

const nodeDescriptions: Record<NodeType, string> = {
  market: "Select market type and filters",
  entry: "Define entry conditions",
  exit: "Define exit conditions",
  profit: "Set profit taking targets",
  and: "AND logic combinator",
  or: "OR logic combinator",
  add: "Add (+) operator",
  subtract: "Subtract (−) operator",
  multiply: "Multiply (×) operator",
  divide: "Divide (÷) operator",
};

interface NodeLibraryProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>, nodeType: NodeType, stage: string) => void;
}

export function NodeLibrary({ onDragStart }: NodeLibraryProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>("market");

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-gray-100">Node Library</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(stageNodes).map(([stage, nodes]) => (
          <div key={stage} className="mb-4">
            <button
              onClick={() => setExpandedStage(expandedStage === stage ? null : stage)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-100 font-medium"
            >
              <Plus
                className={`w-4 h-4 transition-transform ${
                  expandedStage === stage ? "rotate-45" : ""
                }`}
              />
              <span className="text-sm capitalize">
                {stage === "market"
                  ? "Market Type"
                  : stage === "entry"
                    ? "Entry Conditions"
                    : stage === "exit"
                      ? "Exit Conditions"
                      : stage === "profit"
                        ? "Profit Taking"
                        : "Logic (Connections)"}
              </span>
            </button>

            {expandedStage === stage && (
              <div className="ml-4 mt-2 space-y-2">
                {nodes.map((nodeType) => (
                  <div
                    key={nodeType}
                    draggable
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, nodeType as NodeType, stage)}
                    className="p-3 bg-gray-800/40 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-100 capitalize">
                      {nodeType === "and"
                        ? "AND"
                        : nodeType === "or"
                          ? "OR"
                          : nodeType === "add"
                            ? "Add"
                            : nodeType === "subtract"
                              ? "Subtract"
                              : nodeType === "multiply"
                                ? "Multiply"
                                : nodeType === "divide"
                                  ? "Divide"
                                  : nodeType === "market"
                                    ? "Market Type"
                                    : nodeType === "profit"
                                      ? "Take Profit"
                                      : nodeType}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {nodeDescriptions[nodeType as NodeType]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
