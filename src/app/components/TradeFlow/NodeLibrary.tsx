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
    <div className="tradeflow-sidebar">
      <div className="tradeflow-sidebar-header">
        <h2>Node Library</h2>
      </div>

      <div className="tradeflow-sidebar-content">
        {Object.entries(stageNodes).map(([stage, nodes]) => (
          <div key={stage} className="node-section">
            <button
              onClick={() => setExpandedStage(expandedStage === stage ? null : stage)}
              className="node-section-button"
            >
              <Plus
                className={`node-section-icon ${expandedStage === stage ? "expanded" : ""}`}
              />
              <span>
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
              <div className="node-section-expanded" style={{
                marginLeft: 'var(--sp-3)',
                marginTop: 'var(--sp-2)',
                ...(stage === "logic"
                  ? { display: 'flex', justifyContent: 'center', gap: 'var(--sp-4)' }
                  : { display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }
                )
              }}>
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
                      <div className={`logic-node ${nodeType}`}>
                        {nodeType === "and" ? "AND" : "OR"}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={nodeType}
                      draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, nodeType as NodeType, stage)}
                      className="node-card"
                    >
                      <div className="node-card-title">
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
                      <div className="node-card-desc">
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
