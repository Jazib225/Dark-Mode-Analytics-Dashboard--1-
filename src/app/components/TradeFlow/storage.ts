// TradeFlow storage utilities
import { NodeData, NodeStage, WorkflowSchema } from "./types";

// Generate a simple UUID-like string
function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateWorkflowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const WORKFLOWS_STORAGE_KEY = "paragon_tradeflow_workflows";
const CURRENT_WORKFLOW_KEY = "paragon_tradeflow_current";

// Save all workflows to localStorage
function saveAllWorkflows(workflows: WorkflowSchema[]): void {
  try {
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
  } catch (error) {
    console.error("Failed to save workflows:", error);
  }
}

// Load all workflows from localStorage
function loadAllWorkflows(): WorkflowSchema[] {
  try {
    const data = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as WorkflowSchema[];
  } catch (error) {
    console.error("Failed to load workflows:", error);
    return [];
  }
}

// Save current workflow ID
function saveCurrentWorkflowId(id: string): void {
  try {
    localStorage.setItem(CURRENT_WORKFLOW_KEY, id);
  } catch (error) {
    console.error("Failed to save current workflow ID:", error);
  }
}

// Load current workflow ID
function loadCurrentWorkflowId(): string | null {
  try {
    return localStorage.getItem(CURRENT_WORKFLOW_KEY);
  } catch (error) {
    console.error("Failed to load current workflow ID:", error);
    return null;
  }
}

export function saveWorkflow(schema: WorkflowSchema): void {
  try {
    const workflows = loadAllWorkflows();
    const index = workflows.findIndex((w) => w.id === schema.id);
    
    if (index >= 0) {
      // Update existing workflow
      workflows[index] = schema;
    } else {
      // Add new workflow
      workflows.push(schema);
    }
    
    saveAllWorkflows(workflows);
    saveCurrentWorkflowId(schema.id);
  } catch (error) {
    console.error("Failed to save workflow:", error);
  }
}

export function loadWorkflow(id?: string): WorkflowSchema | null {
  try {
    const workflows = loadAllWorkflows();
    if (workflows.length === 0) return null;
    
    // If specific ID requested, find it
    if (id) {
      return workflows.find((w) => w.id === id) || null;
    }
    
    // Otherwise load current or first one
    const currentId = loadCurrentWorkflowId();
    if (currentId) {
      return workflows.find((w) => w.id === currentId) || workflows[0] || null;
    }
    
    return workflows[0] || null;
  } catch (error) {
    console.error("Failed to load workflow:", error);
    return null;
  }
}

export function getAllWorkflows(): WorkflowSchema[] {
  return loadAllWorkflows();
}

export function deleteWorkflow(id: string): void {
  try {
    let workflows = loadAllWorkflows();
    workflows = workflows.filter((w) => w.id !== id);
    saveAllWorkflows(workflows);
    
    // If deleted workflow was current, switch to first available
    const currentId = loadCurrentWorkflowId();
    if (currentId === id && workflows.length > 0) {
      saveCurrentWorkflowId(workflows[0].id);
    }
  } catch (error) {
    console.error("Failed to delete workflow:", error);
  }
}

export function renameWorkflow(id: string, newTitle: string): WorkflowSchema | null {
  try {
    const workflows = loadAllWorkflows();
    const index = workflows.findIndex((w) => w.id === id);
    
    if (index >= 0) {
      workflows[index].title = newTitle;
      workflows[index].lastSavedAt = Date.now();
      saveAllWorkflows(workflows);
      return workflows[index];
    }
    return null;
  } catch (error) {
    console.error("Failed to rename workflow:", error);
    return null;
  }
}

export function clearWorkflow(): void {
  try {
    const workflows = loadAllWorkflows();
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
    localStorage.removeItem(CURRENT_WORKFLOW_KEY);
  } catch (error) {
    console.error("Failed to clear workflow:", error);
  }
}

export function createDefaultWorkflow(): WorkflowSchema {
  return {
    id: generateWorkflowId(),
    title: "Untitled Flow",
    version: "2.0",
    nodes: [],
    edges: [],
    createdAt: Date.now(),
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
