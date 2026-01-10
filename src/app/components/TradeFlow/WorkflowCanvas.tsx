import React, { useEffect, useRef, useState } from "react";
import { NodeData, EdgeData, NodeStage } from "./types";
import { WorkflowNode } from "./WorkflowNode";
import { canConnect } from "./validators";

interface WorkflowCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDrop: (nodeType: string, stage: NodeStage, position: { x: number; y: number }) => void;
  onEdgeCreate: (sourceId: string, targetId: string) => void;
  onSetPendingHandles: (sourceHandle: string, targetHandle: string) => void;
  onEdgeLogicAdd: (edgeId: string, logic: "and" | "or") => void;
  onCanvasClick: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Column definitions: stage -> {label, percentStart, percentWidth, bgColor}
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

function getNodeRect(node: NodeData): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: 160, // w-40 = 160px
    height: 120, // approximate height
  };
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

// Constrain position within column boundaries
function constrainPositionToColumn(x: number, y: number, stage: NodeStage, canvasWidth: number): { x: number; y: number } {
  const col = getColumnBounds(stage, canvasWidth);
  const nodeWidth = 160;
  const constrainedX = Math.max(col.startX, Math.min(x, col.startX + col.width - nodeWidth));
  const constrainedY = Math.max(60, y); // Leave space for header
  return { x: constrainedX, y: constrainedY };
}

// Calculate distance from point (px, py) to line segment from (x1, y1) to (x2, y2)
function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

// Calculate handle position given node position and handle ID
function getHandlePosition(nodePos: { x: number; y: number }, handleId: string = "right"): { x: number; y: number } {
  // Node dimensions: 160px wide, ~120px tall
  const nodeWidth = 160;
  const nodeHeight = 120;
  const centerX = nodePos.x + nodeWidth / 2;
  const centerY = nodePos.y + nodeHeight / 2;
  
  switch (handleId) {
    case "top":
      return { x: centerX, y: nodePos.y };
    case "right":
      return { x: nodePos.x + nodeWidth, y: centerY };
    case "bottom":
      return { x: centerX, y: nodePos.y + nodeHeight };
    case "left":
      return { x: nodePos.x, y: centerY };
    default:
      return { x: nodePos.x + nodeWidth, y: centerY }; // default to right
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
  onSetPendingHandles,
  onEdgeLogicAdd,
  onCanvasClick,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [sourceHandleId, setSourceHandleId] = useState<string>("right"); // track which handle is being dragged from
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggingLogicNode, setDraggingLogicNode] = useState<boolean>(false);
  const [highlightedHandles, setHighlightedHandles] = useState<Set<string>>(new Set());
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Handle canvas resize
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const resizeCanvas = () => {
      const canvas = canvasRef.current!;
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Redraw canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw column backgrounds and headers
    const stages: NodeStage[] = ["market", "entry", "exit", "profit"];
    stages.forEach((stage) => {
      const col = getColumnBounds(stage, canvas.width);
      const def = columnDefinitions[stage];
      
      // Draw column background
      ctx.fillStyle = def.bgColor;
      ctx.fillRect(col.startX, 0, col.width, canvas.height);
      
      // Draw column border
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.strokeRect(col.startX, 0, col.width, canvas.height);
    });

    // Draw grid BEFORE headers so headers appear on top
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

    // Draw column headers LAST so they appear above grid
    stages.forEach((stage) => {
      const col = getColumnBounds(stage, canvas.width);
      const def = columnDefinitions[stage];
      
      // Header background box with darker tint - semi-opaque
      const headerHeight = 50;
      ctx.fillStyle = def.bgColor.replace("0.15", "0.5"); // More opaque for readability
      ctx.fillRect(col.startX, 0, col.width, headerHeight);
      
      // Semi-opaque dark overlay for text contrast
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(col.startX, 0, col.width, headerHeight);
      
      // Header text - bold and bright
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(def.label, col.startX + 12, 25);
    });

    // Draw edges
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        // Calculate edge endpoint positions from specific handles
        const sourceHandleId = edge.sourceHandle || "right";
        const targetHandleId = edge.targetHandle || "left";
        
        const fromPos = getHandlePosition(sourceNode.position, sourceHandleId);
        const toPos = getHandlePosition(targetNode.position, targetHandleId);
        
        const fromX = fromPos.x;
        const fromY = fromPos.y;
        const toX = toPos.x;
        const toY = toPos.y;
        
        // Determine line width: base=2, all edges thickened when dragging logic (+1), even more if hovered (+1)
        let lineWidth = 2;
        if (draggingLogicNode) {
          lineWidth = 3; // All edges thicker when dragging logic node
          if (hoveredEdgeId === edge.id) {
            lineWidth = 4; // Hovered edge even thicker
          }
        }
        
        // Draw white line with optional glow effect
        if (hoveredEdgeId === edge.id && draggingLogicNode) {
          // Add subtle glow for hovered edge
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = lineWidth + 4;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
        }
        
        // Draw main white line
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // Draw AND/OR logic badge on edge if present
        if (edge.data?.logic) {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const logic = edge.data.logic.toUpperCase();
          
          // Draw circle badge
          ctx.fillStyle = logic === "AND" ? "#4f46e5" : "#f59e0b";
          ctx.beginPath();
          ctx.arc(midX, midY, 12, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          // Draw text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(logic === "AND" ? "AND" : "OR", midX, midY);
        }
      }
    });

    // Draw connection in progress
    if (connectionStart) {
      const startNode = nodes.find((n) => n.id === connectionStart);
      if (startNode) {
        const fromPos = getHandlePosition(startNode.position, sourceHandleId); // Use the actual source handle
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [nodes, edges, connectionStart, mousePos, draggingLogicNode, hoveredEdgeId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // Check if hovering over edges when dragging logic node
    if (draggingLogicNode) {
      let foundEdge: string | null = null;
      const tolerance = 15;
      
      for (const edge of edges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const sourceHandleId = edge.sourceHandle || "right";
          const targetHandleId = edge.targetHandle || "left";
          const fromPos = getHandlePosition(sourceNode.position, sourceHandleId);
          const toPos = getHandlePosition(targetNode.position, targetHandleId);
          
          const dist = distanceToLineSegment(x, y, fromPos.x, fromPos.y, toPos.x, toPos.y);
          if (dist < tolerance) {
            foundEdge = edge.id;
            break;
          }
        }
      }
      setHoveredEdgeId(foundEdge);
    }

    if (connectionStart) {
      // Highlight valid target handles
      const validTargets = new Set<string>();
      for (const node of nodes) {
        if (node.id !== connectionStart) {
          const sourceNode = nodes.find((n) => n.id === connectionStart);
          if (sourceNode && canConnect(sourceNode.type, node.type, sourceNode.stage, node.stage)) {
            validTargets.add(`input-${node.id}`);
          }
        }
      }
      setHighlightedHandles(validTargets);
    }

    if (draggingNode && containerRef.current) {
      const node = nodes.find((n) => n.id === draggingNode);
      if (node) {
        const newPos = {
          x: x - dragOffset.x,
          y: y - dragOffset.y,
        };
        // Constrain to column boundaries
        const constrainedPos = constrainPositionToColumn(newPos.x, newPos.y, node.stage, containerRef.current.clientWidth);
        onNodeMove(draggingNode, constrainedPos);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Check if clicked on a handle
    const target = e.target as HTMLElement;
    const handleType = target.getAttribute("data-handle-type");
    const handleId = target.getAttribute("data-handle-id");
    const nodeId = target.getAttribute("data-node-id");
    
    if (handleType === "output" && nodeId && handleId) {
      // Start connection from output handle - record which handle is being dragged from
      setConnectionStart(nodeId);
      setSourceHandleId(handleId);
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
      // Left click to select and drag
      onNodeSelect(clickedNodeId);
      setDraggingNode(clickedNodeId);
      const node = nodes.find((n) => n.id === clickedNodeId)!;
      setDragOffset({ x: x - node.position.x, y: y - node.position.y });
    } else {
      onCanvasClick();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    setDraggingNode(null);
    setHighlightedHandles(new Set());

    if (connectionStart) {
      // Check if released on an input handle
      const target = e.target as HTMLElement;
      const handleType = target.getAttribute("data-handle-type");
      const targetHandleId = target.getAttribute("data-handle-id");
      const targetNodeId = target.getAttribute("data-node-id");
      
      if (handleType === "input" && targetNodeId && targetNodeId !== connectionStart && targetHandleId) {
        // Create edge with handle IDs
        onSetPendingHandles(sourceHandleId, targetHandleId);
        onEdgeCreate(connectionStart, targetNodeId);
        setConnectionStart(null);
        setSourceHandleId("right"); // Reset to default
        return;
      }

      setConnectionStart(null);
      setSourceHandleId("right"); // Reset to default
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    
    // Check if dragging a logic node
    const nodeType = e.dataTransfer.types.includes("text/html") ? null : e.dataTransfer.getData("nodeType");
    if ((nodeType === "and" || nodeType === "or")) {
      setDraggingLogicNode(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      setDraggingLogicNode(false);
      setHoveredEdgeId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current || !canvasRef.current) return;

    const nodeType = e.dataTransfer.getData("nodeType");
    const stage = e.dataTransfer.getData("stage");

    if (nodeType && stage) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Check if dropping AND/OR (logic node)
      if ((nodeType === "and" || nodeType === "or") && stage === "logic") {
        // Try to find an edge near the drop point
        let closestEdge = null;
        let minDistance = 20; // tolerance for snapping to edge
        
        for (const edge of edges) {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          
          if (!sourceNode || !targetNode) continue;
          
          const x1 = sourceNode.position.x + 160 + 8;
          const y1 = sourceNode.position.y + 60;
          const x2 = targetNode.position.x - 8;
          const y2 = targetNode.position.y + 60;
          
          // Calculate distance from point to line segment
          const dist = distanceToLineSegment(x, y, x1, y1, x2, y2);
          if (dist < minDistance) {
            minDistance = dist;
            closestEdge = edge;
          }
        }
        
        if (closestEdge) {
          // Add logic to the edge
          onEdgeLogicAdd(closestEdge.id, nodeType as "and" | "or");
        }
        setDraggingLogicNode(false);
        setHoveredEdgeId(null);
        return;
      }
      
      // Check if drop is within the stage's column
      const col = getColumnBounds(stage as NodeStage, canvasRef.current.width);
      if (x >= col.startX && x < col.startX + col.width) {
        const constrainedPos = constrainPositionToColumn(x - 80, y, stage as NodeStage, canvasRef.current.width);
        onNodeDrop(nodeType, stage as NodeStage, constrainedPos);
      }
      setDraggingLogicNode(false);
      setHoveredEdgeId(null);
    }
  };

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
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Nodes rendered on top of canvas (z-10) */}
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

      {/* Help text above canvas */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 z-5 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-600">
            <p className="text-lg mb-2">Drag nodes from the library to get started</p>
            <p className="text-sm">Right-click nodes to connect them</p>
          </div>
        </div>
      )}
    </div>
  );
}
