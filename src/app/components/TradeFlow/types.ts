// TradeFlow types and schema

export type NodeStage = "market" | "entry" | "exit" | "profit";
export type NodeType = "market" | "entry" | "exit" | "profit" | "and" | "or" | "add" | "subtract" | "multiply" | "divide";

export type OperatorType = "and" | "or" | "add" | "subtract" | "multiply" | "divide";

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeData {
  id: string;
  type: NodeType;
  stage: NodeStage;
  position: NodePosition;
  data: Record<string, unknown>;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface WorkflowSchema {
  version: string;
  nodes: NodeData[];
  edges: EdgeData[];
  lastSavedAt: number;
  selectedNodeId: string | null;
}

export interface ValidationError {
  type: "missing_stage" | "invalid_edge" | "malformed_expression";
  message: string;
  nodeId?: string;
}

// Node data types for each stage
export interface MarketNodeData {
  marketType: string;
  searchKeyword?: string;
  minLiquidity?: number;
  minVolume?: number;
}

export interface EntryConditionNodeData {
  field?: string;
  operator?: string;
  value?: string | number;
}

export interface ExitConditionNodeData {
  field?: string;
  operator?: string;
  value?: string | number;
  trailingStop?: boolean;
}

export interface ProfitTakingNodeData {
  type: "percentage" | "threshold";
  value?: number;
  partial?: "25%" | "50%" | "100%";
}
