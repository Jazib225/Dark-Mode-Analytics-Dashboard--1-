import React, { useState, useEffect } from "react";
import { NodeLibrary } from "./TradeFlow/NodeLibrary";
import { WorkflowCanvas } from "./TradeFlow/WorkflowCanvas";
import { NodeInspector } from "./TradeFlow/NodeInspector";
import { WorkflowSchema, NodeStage } from "./TradeFlow/types";
import {
  createDefaultWorkflow,
  saveWorkflow,
  loadWorkflow,
  addNodeToWorkflow,
  updateNodeData,
  moveNode,
  removeNode,
  addEdge,
  addEdgeLogic,
  selectNode,
} from "./TradeFlow/storage";
import { validateWorkflow, canConnect } from "./TradeFlow/validators";
import { Save, CheckCircle, AlertCircle, Trash2, Download } from "lucide-react";

export function TradeFlow() {
  const [workflow, setWorkflow] = useState<WorkflowSchema>(() => {
    const saved = loadWorkflow();
    return saved || createDefaultWorkflow();
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const selectedNode = workflow.nodes.find((n: any) => n.id === workflow.selectedNodeId) || null;

  // Auto-validate on workflow change
  useEffect(() => {
    const errors = validateWorkflow(workflow);
    setValidationErrors(errors.map((e) => e.message));
  }, [workflow]);

  // Auto-save
  useEffect(() => {
    saveWorkflow(workflow);
  }, [workflow]);

  const handleNodeLibraryDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    nodeType: string,
    stage: string
  ) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("nodeType", nodeType);
    e.dataTransfer.setData("stage", stage);
  };

  const handleNodeDrop = (nodeType: string, stage: NodeStage, position: { x: number; y: number }) => {
    setWorkflow(addNodeToWorkflow(workflow, nodeType, stage, position));
  };

  const handleNodeSelect = (nodeId: string) => {
    setWorkflow(selectNode(workflow, nodeId));
  };

  const handleNodeDelete = (nodeId: string) => {
    setWorkflow(removeNode(workflow, nodeId));
  };

  const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
    setWorkflow(moveNode(workflow, nodeId, position));
  };

  const handleNodeDataChange = (data: Record<string, unknown>) => {
    if (selectedNode) {
      setWorkflow(updateNodeData(workflow, selectedNode.id, data));
    }
  };

  const handleEdgeCreate = (sourceId: string, targetId: string) => {
    const sourceNode = workflow.nodes.find((n: any) => n.id === sourceId);
    const targetNode = workflow.nodes.find((n: any) => n.id === targetId);

    if (sourceNode && targetNode && canConnect(sourceNode.type, targetNode.type, sourceNode.stage, targetNode.stage)) {
      setWorkflow(addEdge(workflow, sourceId, targetId));
      setSuccessMessage("Connection created!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } else {
      setValidationErrors([
        ...validationErrors,
        "Invalid connection: cannot connect these nodes in this direction",
      ]);
    }
  };

  const handleEdgeLogicAdd = (edgeId: string, logic: "and" | "or") => {
    setWorkflow(addEdgeLogic(workflow, edgeId, logic));
    setSuccessMessage(`${logic.toUpperCase()} added to connection!`);
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleCanvasClick = () => {
    setWorkflow(selectNode(workflow, null));
  };

  const handleSave = () => {
    saveWorkflow(workflow);
    setSuccessMessage("Workflow saved!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleLoad = () => {
    const saved = loadWorkflow();
    if (saved) {
      setWorkflow(saved);
      setSuccessMessage("Workflow loaded!");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  const handleValidate = () => {
    const errors = validateWorkflow(workflow);
    if (errors.length === 0 && workflow.nodes.length > 0) {
      setSuccessMessage("✓ Workflow is valid!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } else if (workflow.nodes.length === 0) {
      setValidationErrors(["No nodes in workflow"]);
    }
  };

  const handleClear = () => {
    setWorkflow(createDefaultWorkflow());
    setShowClearConfirm(false);
    setSuccessMessage("Canvas cleared");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleExportWorkflow = () => {
    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeflow_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Top toolbar */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">TradeFlow Builder</h1>
            <p className="text-sm text-gray-500 mt-1">Build your trading logic with drag-and-drop nodes</p>
          </div>

          <div className="flex items-center gap-3">
            {successMessage && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm">
                <CheckCircle className="w-4 h-4" />
                {successMessage}
              </div>
            )}

            <button
              onClick={handleValidate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 rounded-lg text-blue-300 text-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Validate
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-900/40 hover:bg-green-900/60 border border-green-700 rounded-lg text-green-300 text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              Save
            </button>

            <button
              onClick={handleExportWorkflow}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {validationErrors.slice(0, 3).map((error: string, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/40 border border-orange-700 rounded-lg text-orange-300 text-xs"
              >
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-sm">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Clear Canvas?</h2>
            <p className="text-gray-400 text-sm mb-6">This will delete all nodes and connections. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-700 rounded-lg text-red-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout - canvas fills entire remaining space */}
      <div className="flex flex-1 w-full overflow-hidden bg-[#0a0a0a]">
        <NodeLibrary onDragStart={handleNodeLibraryDragStart} />

        <WorkflowCanvas
          nodes={workflow.nodes}
          edges={workflow.edges}
          selectedNodeId={workflow.selectedNodeId}
          onNodeSelect={handleNodeSelect}
          onNodeDelete={handleNodeDelete}
          onNodeMove={handleNodeMove}
          onNodeDrop={handleNodeDrop}
          onEdgeCreate={handleEdgeCreate}
          onEdgeLogicAdd={handleEdgeLogicAdd}
          onCanvasClick={handleCanvasClick}
        />

        <NodeInspector node={selectedNode} onDataChange={handleNodeDataChange} />
      </div>

      {/* Status bar */}
      <div className="bg-[#1a1a1a] border-t border-gray-800 px-6 py-3 text-sm text-gray-500 flex justify-between">
        <div>
          {workflow.nodes.length} {workflow.nodes.length === 1 ? "node" : "nodes"} • {workflow.edges.length}{" "}
          {workflow.edges.length === 1 ? "connection" : "connections"}
        </div>
        <div>Last saved: {new Date(workflow.lastSavedAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
