// TradeFlow storage utilities
import { NodeData, NodeStage, WorkflowSchema } from "./types";

// Generate a simple UUID-like string
function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const STORAGE_KEY = "paragon_tradeflow_v2";

export function saveWorkflow(schema: WorkflowSchema): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  } catch (error) {
    console.error("Failed to save workflow:", error);
  }
}

export function loadWorkflow(): WorkflowSchema | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as WorkflowSchema;
  } catch (error) {
    console.error("Failed to load workflow:", error);
    return null;
  }
}

export function clearWorkflow(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear workflow:", error);
  }
}

export function createDefaultWorkflow(): WorkflowSchema {
  return {
    version: "2.0",
    nodes: [],
    edges: [],
    lastSavedAt: Date.now(),
    selectedNodeId: null,
  };
}

export function addNodeToWorkflow(
  workflow: WorkflowSchema,
  nodeType: string,
  stage: NodeStage,
  position: { x: number; y: number }
): WorkflowSchema {
  const newNode: NodeData = {
    id: generateId(),
    type: nodeType as any,
    stage,
    position,
    data: getDefaultNodeData(nodeType as any),
  };

  return {
    ...workflow,
    nodes: [...workflow.nodes, newNode],
  };
}

function getDefaultNodeData(nodeType: string): Record<string, unknown> {
  switch (nodeType) {
    case "market":
      return {
        marketType: "All",
        searchKeyword: "",
        minLiquidity: 0,
        minVolume: 0,
      };
    case "entry":
    case "exit":
      return {
        field: "price",
        operator: ">",
        value: "",
      };
    case "profit":
      return {
        type: "percentage",
        value: 10,
        partial: "100%",
      };
    case "and":
    case "or":
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      return {};
    default:
      return {};
  }
}

export function updateNodeData(
  workflow: WorkflowSchema,
  nodeId: string,
  data: Record<string, unknown>
): WorkflowSchema {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    ),
  };
}

export function moveNode(
  workflow: WorkflowSchema,
  nodeId: string,
  position: { x: number; y: number }
): WorkflowSchema {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === nodeId ? { ...node, position } : node
    ),
  };
}

export function removeNode(workflow: WorkflowSchema, nodeId: string): WorkflowSchema {
  const filteredNodes = workflow.nodes.filter((n) => n.id !== nodeId);
  const filteredEdges = workflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

  return {
    ...workflow,
    nodes: filteredNodes,
    edges: filteredEdges,
    selectedNodeId: workflow.selectedNodeId === nodeId ? null : workflow.selectedNodeId,
  };
}

export function addEdge(
  workflow: WorkflowSchema,
  sourceId: string,
  targetId: string
): WorkflowSchema {
  const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    ...workflow,
    edges: [...workflow.edges, { id: edgeId, source: sourceId, target: targetId }],
  };
}

export function removeEdge(workflow: WorkflowSchema, edgeId: string): WorkflowSchema {
  return {
    ...workflow,
    edges: workflow.edges.filter((e) => e.id !== edgeId),
  };
}

export function addEdgeLogic(workflow: WorkflowSchema, edgeId: string, logic: "and" | "or"): WorkflowSchema {
  return {
    ...workflow,
    edges: workflow.edges.map((e) =>
      e.id === edgeId 
        ? { ...e, data: { ...e.data, logic } }
        : e
    ),
  };
}

export function selectNode(workflow: WorkflowSchema, nodeId: string | null): WorkflowSchema {
  return {
    ...workflow,
    selectedNodeId: nodeId,
  };
}
