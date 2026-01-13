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

  const handleEdgeCreate = (sourceId: string, targetId: string, sourceHandle: string, targetHandle: string) => {
    const sourceNode = workflow.nodes.find((n: any) => n.id === sourceId);
    const targetNode = workflow.nodes.find((n: any) => n.id === targetId);

    if (sourceNode && targetNode && canConnect(sourceNode.type, targetNode.type, sourceNode.stage, targetNode.stage)) {
      setWorkflow(addEdge(workflow, sourceId, targetId, sourceHandle, targetHandle));
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
      <div className="tradeflow-toolbar">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[var(--sp-3)] w-full">
          <div className="flex items-center gap-[var(--sp-2)] min-w-0">
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
                className="tradeflow-input w-full sm:w-auto"
                style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}
              />
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="tradeflow-title-input cursor-pointer hover:text-gray-300 transition-colors truncate"
                style={{ fontSize: 'var(--fs-xl)' }}
              >
                {workflow.title}
              </h1>
            )}
            {isUnsaved && <span className="tradeflow-error" style={{ background: 'rgba(113, 63, 18, 0.4)', borderColor: 'rgba(161, 98, 7, 0.5)', color: 'rgb(253, 224, 71)' }}>Unsaved</span>}
          </div>

          <div className="flex items-center gap-[var(--sp-2)] flex-wrap sm:flex-nowrap">
            {successMessage && (
              <div className="tradeflow-btn tradeflow-btn-primary">
                <CheckCircle style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
                {successMessage}
              </div>
            )}

            <button
              onClick={() => setShowOpenModal(true)}
              className="tradeflow-btn tradeflow-btn-default"
              style={{ background: 'rgba(30, 58, 138, 0.4)', borderColor: 'rgba(29, 78, 216, 0.5)', color: 'rgb(147, 197, 253)' }}
            >
              Open
            </button>

            <button
              onClick={handleNew}
              className="tradeflow-btn tradeflow-btn-default"
            >
              New
            </button>

            <button
              onClick={handleValidate}
              className="tradeflow-btn tradeflow-btn-default"
              style={{ background: 'rgba(30, 58, 138, 0.4)', borderColor: 'rgba(29, 78, 216, 0.5)', color: 'rgb(147, 197, 253)' }}
            >
              <CheckCircle style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
              <span className="hidden sm:inline">Validate</span>
            </button>

            <button
              onClick={handleSave}
              className="tradeflow-btn tradeflow-btn-primary"
            >
              <Save style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="tradeflow-btn tradeflow-btn-danger"
            >
              <Trash2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
              Clear
            </button>
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-[var(--sp-3)] flex gap-[var(--sp-2)] flex-wrap">
            {validationErrors.slice(0, 3).map((error: string, idx: number) => (
              <div
                key={idx}
                className="tradeflow-error"
              >
                <AlertCircle style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open workflow modal */}
      {showOpenModal && (
        <div className="tradeflow-modal-overlay">
          <div className="tradeflow-modal" style={{ maxWidth: 'clamp(280px, 90vw, 450px)', maxHeight: '24rem' }}>
            <h2 className="tradeflow-modal-title">My Workflows</h2>
            {allWorkflows.length === 0 ? (
              <p className="tradeflow-modal-text">No saved workflows yet.</p>
            ) : (
              <div className="space-y-[var(--sp-2)]">
                {allWorkflows.map((wf) => (
                  <div key={wf.id} className="flex items-center justify-between p-[var(--sp-3)] bg-gray-800/50 rounded-[var(--r-md)] hover:bg-gray-800 transition-colors">
                    <div className="flex-1 cursor-pointer" onClick={() => handleOpenWorkflow(wf.id)}>
                      <p className="text-gray-100 font-medium" style={{ fontSize: 'var(--fs-sm)' }}>{wf.title}</p>
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'rgb(107, 114, 128)' }}>
                        {new Date(wf.lastSavedAt).toLocaleDateString()} {new Date(wf.lastSavedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleDeleteWorkflow(wf.id);
                        setAllWorkflows(getAllWorkflows());
                      }}
                      className="tradeflow-btn tradeflow-btn-danger"
                      style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 'var(--fs-xs)' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="tradeflow-modal-actions" style={{ marginTop: 'var(--sp-4)' }}>
              <button
                onClick={() => setShowOpenModal(false)}
                className="tradeflow-btn tradeflow-btn-default"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New workflow confirmation modal */}
      {showNewConfirm && (
        <div className="tradeflow-modal-overlay">
          <div className="tradeflow-modal">
            <h2 className="tradeflow-modal-title">Unsaved Changes</h2>
            <p className="tradeflow-modal-text">You have unsaved changes. Save before starting a new workflow?</p>
            <div className="tradeflow-modal-actions">
              <button
                onClick={() => setShowNewConfirm(false)}
                className="tradeflow-btn tradeflow-btn-default"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSave();
                  createNewWorkflow();
                }}
                className="tradeflow-btn tradeflow-btn-primary"
              >
                Save & New
              </button>
              <button
                onClick={createNewWorkflow}
                className="tradeflow-btn tradeflow-btn-danger"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="tradeflow-modal-overlay">
          <div className="tradeflow-modal">
            <h2 className="tradeflow-modal-title">Clear Canvas?</h2>
            <p className="tradeflow-modal-text">This will delete all nodes and connections. This action cannot be undone.</p>
            <div className="tradeflow-modal-actions">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="tradeflow-btn tradeflow-btn-default"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="tradeflow-btn tradeflow-btn-danger"
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
          onEdgeLogicAdd={handleEdgeLogicAdd}
          onCanvasClick={handleCanvasClick}
        />

        <NodeInspector node={selectedNode} onDataChange={handleNodeDataChange} />
      </div>

      {/* Status bar */}
      <div className="tradeflow-statusbar">
        <div>
          {workflow.nodes.length} {workflow.nodes.length === 1 ? "node" : "nodes"} • {workflow.edges.length}{" "}
          {workflow.edges.length === 1 ? "connection" : "connections"}
        </div>
        <div className="hidden sm:block">Last saved: {new Date(workflow.lastSavedAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
