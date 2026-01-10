import React, { useState, useEffect } from "react";
import { NodeLibrary } from "./TradeFlow/NodeLibrary";
import { WorkflowCanvas } from "./TradeFlow/WorkflowCanvas";
import { NodeInspector } from "./TradeFlow/NodeInspector";
import { WorkflowSchema, NodeStage } from "./TradeFlow/types";
import {
  createDefaultWorkflow,
  saveWorkflow,
  loadWorkflow,
  getAllWorkflows,
  deleteWorkflow,
  addNodeToWorkflow,
  updateNodeData,
  moveNode,
  removeNode,
  addEdge,
  addEdgeLogic,
  selectNode,
} from "./TradeFlow/storage";
import { validateWorkflow, canConnect } from "./TradeFlow/validators";
import { Save, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

export function TradeFlow() {
  const [workflow, setWorkflow] = useState<WorkflowSchema>(() => {
    const saved = loadWorkflow();
    return saved || createDefaultWorkflow();
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [lastSavedWorkflow, setLastSavedWorkflow] = useState<WorkflowSchema>(workflow);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [allWorkflows, setAllWorkflows] = useState<WorkflowSchema[]>(getAllWorkflows());

  // Track if workflow has unsaved changes
  const isUnsaved = JSON.stringify(workflow) !== JSON.stringify(lastSavedWorkflow);
  
  // Track pending handle IDs for edge creation
  const [pendingHandles, setPendingHandles] = useState<{ sourceHandle: string; targetHandle: string } | null>(null);

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
      const sourceHandle = pendingHandles?.sourceHandle || "right";
      const targetHandle = pendingHandles?.targetHandle || "left";
      setWorkflow(addEdge(workflow, sourceId, targetId, sourceHandle, targetHandle));
      setPendingHandles(null);
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
    const updatedWorkflow = { ...workflow, lastSavedAt: Date.now() };
    saveWorkflow(updatedWorkflow);
    setWorkflow(updatedWorkflow);
    setLastSavedWorkflow(updatedWorkflow);
    setAllWorkflows(getAllWorkflows());
    setSuccessMessage("Workflow saved!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleNew = () => {
    if (isUnsaved) {
      setShowNewConfirm(true);
    } else {
      createNewWorkflow();
    }
  };

  const createNewWorkflow = () => {
    const newFlow = createDefaultWorkflow();
    setWorkflow(newFlow);
    setLastSavedWorkflow(newFlow);
    setIsEditingTitle(false);
    setShowNewConfirm(false);
    setSuccessMessage("New workflow started!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleOpenWorkflow = (id: string) => {
    const loaded = loadWorkflow(id);
    if (loaded) {
      setWorkflow(loaded);
      setLastSavedWorkflow(loaded);
      setIsEditingTitle(false);
      setShowOpenModal(false);
      setSuccessMessage(`Opened "${loaded.title}"`);
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  const handleDeleteWorkflow = (id: string) => {
    deleteWorkflow(id);
    setAllWorkflows(getAllWorkflows());
    setSuccessMessage("Workflow deleted!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleTitleChange = (newTitle: string) => {
    setWorkflow({ ...workflow, title: newTitle });
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Top toolbar */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={workflow.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingTitle(false);
                }}
                className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-gray-100 text-lg font-bold"
              />
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="text-2xl font-bold text-gray-100 cursor-pointer hover:text-gray-300 transition-colors"
              >
                {workflow.title}
              </h1>
            )}
            {isUnsaved && <span className="text-xs px-2 py-1 bg-yellow-900/40 border border-yellow-700 rounded text-yellow-300">Unsaved</span>}
          </div>

          <div className="flex items-center gap-3">
            {successMessage && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm">
                <CheckCircle className="w-4 h-4" />
                {successMessage}
              </div>
            )}

            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 rounded-lg text-blue-300 text-sm transition-colors"
            >
              Open
            </button>

            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              New
            </button>

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

      {/* Open workflow modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-md max-h-96 overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">My Workflows</h2>
            {allWorkflows.length === 0 ? (
              <p className="text-gray-400 text-sm">No saved workflows yet.</p>
            ) : (
              <div className="space-y-2">
                {allWorkflows.map((wf) => (
                  <div key={wf.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
                    <div className="flex-1 cursor-pointer" onClick={() => handleOpenWorkflow(wf.id)}>
                      <p className="text-gray-100 font-medium">{wf.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(wf.lastSavedAt).toLocaleDateString()} {new Date(wf.lastSavedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleDeleteWorkflow(wf.id);
                        setAllWorkflows(getAllWorkflows());
                      }}
                      className="px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/60 border border-red-700 rounded text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New workflow confirmation modal */}
      {showNewConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-sm">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Unsaved Changes</h2>
            <p className="text-gray-400 text-sm mb-6">You have unsaved changes. Save before starting a new workflow?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewConfirm(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSave();
                  createNewWorkflow();
                }}
                className="px-4 py-2 bg-green-900/40 hover:bg-green-900/60 border border-green-700 rounded-lg text-green-300 transition-colors"
              >
                Save & New
              </button>
              <button
                onClick={createNewWorkflow}
                className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-700 rounded-lg text-red-300 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Main layout - canvas fills entire remaining space without scrolling */}
      <div className="flex flex-1 w-full h-full overflow-hidden bg-[#0a0a0a]">
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
          onSetPendingHandles={(sourceHandle: string, targetHandle: string) => setPendingHandles({ sourceHandle, targetHandle })}
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
