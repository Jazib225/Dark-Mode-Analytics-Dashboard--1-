import React, { useState } from "react";
import { Plus } from "lucide-react";

type NodeType = "market" | "entry" | "exit" | "profit" | "and" | "or" | "add" | "subtract" | "multiply" | "divide";

const stageNodes = {
  market: ["market"],
  entry: ["entry"],
  exit: ["exit"],
  profit: ["profit"],
  operators: ["add", "subtract", "multiply", "divide"],
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
                        : stage === "operators"
                          ? "Operators"
                          : "Logic (Connections)"}
              </span>
            </button>

            {expandedStage === stage && (
              <div className={`ml-4 mt-2 ${stage === "logic" ? "flex justify-center gap-4" : "space-y-2"}`}>
                {nodes.map((nodeType) => {
                  const isLogic = stage === "logic";
                  return isLogic ? (
                    <div
                      key={nodeType}
                      draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, nodeType as NodeType, stage)}
                      className="cursor-grab active:cursor-grabbing transition-all"
                      title={nodeType === "and" ? "AND Logic" : "OR Logic"}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white border-2 border-gray-500 hover:scale-110 transition-transform hover:border-gray-300"
                        style={{
                          background:
                            nodeType === "and"
                              ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                              : "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
                        }}
                      >
                        {nodeType === "and" ? "&" : "|"}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={nodeType}
                      draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, nodeType as NodeType, stage)}
                      className="p-3 bg-gray-800/40 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-100 capitalize">
                        {nodeType === "add"
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
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
