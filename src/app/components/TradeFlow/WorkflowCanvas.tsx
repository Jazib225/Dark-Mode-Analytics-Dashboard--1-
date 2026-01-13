import React, { useEffect, useRef, useState, useCallback } from "react";
import { NodeData, EdgeData, NodeStage } from "./types";
import { WorkflowNode } from "./WorkflowNode";
import { canConnect } from "./validators";
import { useScreenSize } from "../../hooks/useScreenSize";

interface WorkflowCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDrop: (nodeType: string, stage: NodeStage, position: { x: number; y: number }) => void;
  onEdgeCreate: (sourceId: string, targetId: string, sourceHandle: string, targetHandle: string) => void;
  onEdgeLogicAdd: (edgeId: string, logic: "and" | "or") => void;
  onCanvasClick: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Column definitions
const columnDefinitions: Record<NodeStage, { label: string; percentStart: number; percentWidth: number; bgColor: string }> = {
  market: { label: "Market Type", percentStart: 0, percentWidth: 25, bgColor: "rgba(30, 58, 138, 0.15)" },
  entry: { label: "Entry Conditions", percentStart: 25, percentWidth: 25, bgColor: "rgba(20, 83, 45, 0.15)" },
  exit: { label: "Exit Conditions", percentStart: 50, percentWidth: 25, bgColor: "rgba(120, 53, 15, 0.15)" },
  profit: { label: "Profit Taking", percentStart: 75, percentWidth: 25, bgColor: "rgba(88, 28, 135, 0.15)" },
};

function getColumnBounds(stage: NodeStage, canvasWidth: number): { startX: number; width: number } {
  const def = columnDefinitions[stage];
  return {
    startX: (canvasWidth * def.percentStart) / 100,
    width: (canvasWidth * def.percentWidth) / 100,
  };
}

// Node dimensions - MUST match WorkflowNode CSS exactly
const NODE_WIDTH = 160;  // w-40 = 160px
const NODE_HEIGHT = 80;  // h-20 = 80px

function getNodeRect(node: NodeData): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function constrainPositionToColumn(x: number, y: number, stage: NodeStage, canvasWidth: number): { x: number; y: number } {
  const col = getColumnBounds(stage, canvasWidth);
  const constrainedX = Math.max(col.startX, Math.min(x, col.startX + col.width - NODE_WIDTH));
  const constrainedY = Math.max(60, y);
  return { x: constrainedX, y: constrainedY };
}

function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

// Get the exact pixel position of a handle on a node
// This MUST match where the CSS positions the black dots
function getHandlePosition(nodePos: { x: number; y: number }, handleId: string): { x: number; y: number } {
  // The node is positioned at nodePos.x, nodePos.y with size NODE_WIDTH x NODE_HEIGHT
  // CSS handles are positioned at the edge centers:
  // - top: top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 -> center of top edge
  // - right: right-0 top-1/2 translate-x-1/2 -translate-y-1/2 -> center of right edge
  // - bottom: bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 -> center of bottom edge
  // - left: left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 -> center of left edge

  switch (handleId) {
    case "top":
      return { x: nodePos.x + NODE_WIDTH / 2, y: nodePos.y };
    case "right":
      return { x: nodePos.x + NODE_WIDTH, y: nodePos.y + NODE_HEIGHT / 2 };
    case "bottom":
      return { x: nodePos.x + NODE_WIDTH / 2, y: nodePos.y + NODE_HEIGHT };
    case "left":
      return { x: nodePos.x, y: nodePos.y + NODE_HEIGHT / 2 };
    default:
      return { x: nodePos.x + NODE_WIDTH, y: nodePos.y + NODE_HEIGHT / 2 };
  }
}

// Find the nearest handle on a node to a given point
function findNearestHandle(nodePos: { x: number; y: number }, mouseX: number, mouseY: number): { handleId: string; distance: number } {
  const handles = ["top", "right", "bottom", "left"];
  let nearestHandle = "right";
  let minDistance = Infinity;

  for (const handleId of handles) {
    const pos = getHandlePosition(nodePos, handleId);
    const dist = Math.sqrt((mouseX - pos.x) ** 2 + (mouseY - pos.y) ** 2);
    if (dist < minDistance) {
      minDistance = dist;
      nearestHandle = handleId;
    }
  }

  return { handleId: nearestHandle, distance: minDistance };
}

// Determine the best handles to connect two nodes based on their relative positions
function getBestHandles(sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }): { sourceHandle: string; targetHandle: string } {
  const dx = (targetPos.x + NODE_WIDTH / 2) - (sourcePos.x + NODE_WIDTH / 2);
  const dy = (targetPos.y + NODE_HEIGHT / 2) - (sourcePos.y + NODE_HEIGHT / 2);

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      return { sourceHandle: "right", targetHandle: "left" };
    } else {
      return { sourceHandle: "left", targetHandle: "right" };
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      return { sourceHandle: "bottom", targetHandle: "top" };
    } else {
      return { sourceHandle: "top", targetHandle: "bottom" };
    }
  }
}

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onNodeDelete,
  onNodeMove,
  onNodeDrop,
  onEdgeCreate,
  onEdgeLogicAdd,
  onCanvasClick,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic screen sizing - provides responsive size configurations
  const { sizes } = useScreenSize();

  // Use refs for drag state to avoid re-renders during drag (smoother experience)
  const draggingNodeRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const connectionStartRef = useRef<string | null>(null);
  const sourceHandleIdRef = useRef<string>("right");
  const mousePosRef = useRef({ x: 0, y: 0 });

  // State for UI updates
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggingLogicNode, setDraggingLogicNode] = useState<boolean>(false);
  const [highlightedHandles, setHighlightedHandles] = useState<Set<string>>(new Set());
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Draw function - extracted for reuse
  const draw = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw columns
    const stages: NodeStage[] = ["market", "entry", "exit", "profit"];
    stages.forEach((stage) => {
      const col = getColumnBounds(stage, canvas.width);
      const def = columnDefinitions[stage];
      ctx.fillStyle = def.bgColor;
      ctx.fillRect(col.startX, 0, col.width, canvas.height);
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.strokeRect(col.startX, 0, col.width, canvas.height);
    });

    // Draw grid
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw column headers
    stages.forEach((stage) => {
      const col = getColumnBounds(stage, canvas.width);
      const def = columnDefinitions[stage];
      const headerHeight = 50;
      ctx.fillStyle = def.bgColor.replace("0.15", "0.5");
      ctx.fillRect(col.startX, 0, col.width, headerHeight);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(col.startX, 0, col.width, headerHeight);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(def.label, col.startX + 12, 25);
    });

    // Draw edges - connecting to exact handle positions
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        // Get or calculate handles
        let sourceHandleId = edge.sourceHandle;
        let targetHandleId = edge.targetHandle;

        if (!sourceHandleId || !targetHandleId) {
          const bestHandles = getBestHandles(sourceNode.position, targetNode.position);
          sourceHandleId = sourceHandleId || bestHandles.sourceHandle;
          targetHandleId = targetHandleId || bestHandles.targetHandle;
        }

        // Get exact handle positions
        const fromPos = getHandlePosition(sourceNode.position, sourceHandleId);
        const toPos = getHandlePosition(targetNode.position, targetHandleId);

        let lineWidth = 2;
        if (draggingLogicNode) {
          lineWidth = 3;
          if (hoveredEdgeId === edge.id) {
            lineWidth = 4;
            // Glow
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = lineWidth + 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.lineTo(toPos.x, toPos.y);
            ctx.stroke();
          }
        }

        // Main line
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();

        // Logic badge
        if (edge.data?.logic) {
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;
          const logic = edge.data.logic.toUpperCase();

          ctx.fillStyle = logic === "AND" ? "#4f46e5" : "#f59e0b";
          ctx.beginPath();
          ctx.arc(midX, midY, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(logic, midX, midY);
        }
      }
    });

    // Draw connection in progress (dashed line from handle to mouse)
    if (connectionStartRef.current) {
      const startNode = nodes.find((n) => n.id === connectionStartRef.current);
      if (startNode) {
        const fromPos = getHandlePosition(startNode.position, sourceHandleIdRef.current);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [nodes, edges, draggingLogicNode, hoveredEdgeId]);

  // Resize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const resizeCanvas = () => {
      const canvas = canvasRef.current!;
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [draw]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw, connectionStart, mousePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePosRef.current = { x, y };

    // Handle node dragging with immediate feedback
    if (draggingNodeRef.current && containerRef.current) {
      const node = nodes.find((n) => n.id === draggingNodeRef.current);
      if (node) {
        const newPos = {
          x: x - dragOffsetRef.current.x,
          y: y - dragOffsetRef.current.y,
        };
        const constrainedPos = constrainPositionToColumn(newPos.x, newPos.y, node.stage, containerRef.current.clientWidth);
        onNodeMove(draggingNodeRef.current, constrainedPos);
        // Immediate redraw for smooth dragging
        draw();
      }
    }

    // Update UI state for connection drawing
    if (connectionStartRef.current) {
      setMousePos({ x, y });

      // Highlight valid target handles
      const validTargets = new Set<string>();
      for (const node of nodes) {
        if (node.id !== connectionStartRef.current) {
          const sourceNode = nodes.find((n) => n.id === connectionStartRef.current);
          if (sourceNode && canConnect(sourceNode.type, node.type, sourceNode.stage, node.stage)) {
            validTargets.add(`input-${node.id}`);
          }
        }
      }
      setHighlightedHandles(validTargets);
    }

    // Check edge hover when dragging logic node
    if (draggingLogicNode) {
      let foundEdge: string | null = null;
      const tolerance = 15;

      for (const edge of edges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const sHandle = edge.sourceHandle || "right";
          const tHandle = edge.targetHandle || "left";
          const fromPos = getHandlePosition(sourceNode.position, sHandle);
          const toPos = getHandlePosition(targetNode.position, tHandle);

          const dist = distanceToLineSegment(x, y, fromPos.x, fromPos.y, toPos.x, toPos.y);
          if (dist < tolerance) {
            foundEdge = edge.id;
            break;
          }
        }
      }
      setHoveredEdgeId(foundEdge);
    }
  }, [nodes, edges, draggingLogicNode, onNodeMove, draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    // Check if clicked on a handle
    const target = e.target as HTMLElement;
    const handleType = target.getAttribute("data-handle-type");
    const handleId = target.getAttribute("data-handle-id");
    const nodeId = target.getAttribute("data-node-id");

    if ((handleType === "output" || handleType === "input") && nodeId && handleId) {
      // Start connection from this handle
      connectionStartRef.current = nodeId;
      sourceHandleIdRef.current = handleId;
      setConnectionStart(nodeId);
      e.stopPropagation();
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a node
    let clickedNodeId: string | null = null;
    for (const node of nodes) {
      if (pointInRect(x, y, getNodeRect(node))) {
        clickedNodeId = node.id;
        break;
      }
    }

    if (clickedNodeId) {
      onNodeSelect(clickedNodeId);
      draggingNodeRef.current = clickedNodeId;
      const node = nodes.find((n) => n.id === clickedNodeId)!;
      dragOffsetRef.current = { x: x - node.position.x, y: y - node.position.y };
    } else {
      onCanvasClick();
    }
  }, [nodes, onNodeSelect, onCanvasClick]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    // Clear drag state
    draggingNodeRef.current = null;
    setHighlightedHandles(new Set());

    if (connectionStartRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if released on a handle element
      const target = e.target as HTMLElement;
      const targetHandleId = target.getAttribute("data-handle-id");
      const targetNodeId = target.getAttribute("data-node-id");

      if (targetNodeId && targetNodeId !== connectionStartRef.current && targetHandleId) {
        const sourceNode = nodes.find((n) => n.id === connectionStartRef.current);
        const targetNode = nodes.find((n) => n.id === targetNodeId);

        if (sourceNode && targetNode && canConnect(sourceNode.type, targetNode.type, sourceNode.stage, targetNode.stage)) {
          // Create edge with the handles that were actually used
          onEdgeCreate(connectionStartRef.current, targetNodeId, sourceHandleIdRef.current, targetHandleId);
        }
      } else {
        // Check proximity to any node's handles
        const handleSnapDistance = 30;
        let bestTarget: { nodeId: string; handleId: string; distance: number } | null = null;

        for (const node of nodes) {
          if (node.id === connectionStartRef.current) continue;

          const sourceNode = nodes.find((n) => n.id === connectionStartRef.current);
          if (!sourceNode || !canConnect(sourceNode.type, node.type, sourceNode.stage, node.stage)) continue;

          const nearest = findNearestHandle(node.position, x, y);
          if (nearest.distance < handleSnapDistance) {
            if (!bestTarget || nearest.distance < bestTarget.distance) {
              bestTarget = { nodeId: node.id, handleId: nearest.handleId, distance: nearest.distance };
            }
          }
        }

        if (bestTarget) {
          onEdgeCreate(connectionStartRef.current, bestTarget.nodeId, sourceHandleIdRef.current, bestTarget.handleId);
        }
      }

      // Clear connection state
      connectionStartRef.current = null;
      sourceHandleIdRef.current = "right";
      setConnectionStart(null);
    }
  }, [nodes, onEdgeCreate]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";

    const nodeType = e.dataTransfer.types.includes("text/html") ? null : e.dataTransfer.getData("nodeType");
    if ((nodeType === "and" || nodeType === "or")) {
      setDraggingLogicNode(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      setDraggingLogicNode(false);
      setHoveredEdgeId(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current || !canvasRef.current) return;

    const nodeType = e.dataTransfer.getData("nodeType");
    const stage = e.dataTransfer.getData("stage");

    if (nodeType && stage) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if ((nodeType === "and" || nodeType === "or") && stage === "logic") {
        let closestEdge = null;
        let minDistance = 20;

        for (const edge of edges) {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);

          if (!sourceNode || !targetNode) continue;

          const sHandle = edge.sourceHandle || "right";
          const tHandle = edge.targetHandle || "left";
          const fromPos = getHandlePosition(sourceNode.position, sHandle);
          const toPos = getHandlePosition(targetNode.position, tHandle);

          const dist = distanceToLineSegment(x, y, fromPos.x, fromPos.y, toPos.x, toPos.y);
          if (dist < minDistance) {
            minDistance = dist;
            closestEdge = edge;
          }
        }

        if (closestEdge) {
          onEdgeLogicAdd(closestEdge.id, nodeType as "and" | "or");
        }
        setDraggingLogicNode(false);
        setHoveredEdgeId(null);
        return;
      }

      const col = getColumnBounds(stage as NodeStage, canvasRef.current.width);
      if (x >= col.startX && x < col.startX + col.width) {
        const constrainedPos = constrainPositionToColumn(x - 80, y, stage as NodeStage, canvasRef.current.width);
        onNodeDrop(nodeType, stage as NodeStage, constrainedPos);
      }
      setDraggingLogicNode(false);
      setHoveredEdgeId(null);
    }
  }, [nodes, edges, onNodeDrop, onEdgeLogicAdd]);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full bg-[#0a0a0a] relative overflow-hidden cursor-default"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Nodes on top of canvas */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {nodes.map((node) => (
          <div key={node.id} className="pointer-events-auto">
            <WorkflowNode
              node={node}
              isSelected={selectedNodeId === node.id}
              onSelect={onNodeSelect}
              onDelete={onNodeDelete}
              highlightedInputHandle={highlightedHandles.has(`input-${node.id}`)}
            />
          </div>
        ))}
      </div>

      {/* Help text */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 z-5 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-600">
            <p className={`${sizes.textLg} mb-2`}>Drag nodes from the library to get started</p>
            <p className={sizes.textSm}>Click and drag from black dots to connect nodes</p>
          </div>
        </div>
      )}
    </div>
  );
}
