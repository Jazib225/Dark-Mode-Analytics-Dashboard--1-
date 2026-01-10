import React, { useEffect, useRef, useState } from "react";
import { NodeData, EdgeData, NodeStage } from "./types";
import { WorkflowNode } from "./WorkflowNode";

interface WorkflowCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDrop: (nodeType: string, stage: NodeStage, position: { x: number; y: number }) => void;
  onEdgeCreate: (sourceId: string, targetId: string) => void;
  onEdgeLogicAdd: (edgeId: string, logic: "and" | "or") => void;
  onCanvasClick: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Column definitions: stage -> {label, startX, width, bgColor}
const columns: Record<NodeStage, { label: string; startX: number; width: number; bgColor: string }> = {
  market: { label: "Market Type", startX: 0, width: 320, bgColor: "rgba(30, 58, 138, 0.15)" },
  entry: { label: "Entry Conditions", startX: 320, width: 320, bgColor: "rgba(20, 83, 45, 0.15)" },
  exit: { label: "Exit Conditions", startX: 640, width: 320, bgColor: "rgba(120, 53, 15, 0.15)" },
  profit: { label: "Profit Taking", startX: 960, width: 320, bgColor: "rgba(88, 28, 135, 0.15)" },
};

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
function constrainPositionToColumn(x: number, y: number, stage: NodeStage): { x: number; y: number } {
  const col = columns[stage];
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

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string = "#888"
) {
  const headlen = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  // Draw line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Draw arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
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
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
      const col = columns[stage];
      // Draw column background
      ctx.fillStyle = col.bgColor;
      ctx.fillRect(col.startX, 0, col.width, canvas.height);
      
      // Draw column border
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.strokeRect(col.startX, 0, col.width, canvas.height);
      
      // Draw column header
      ctx.fillStyle = "#999999";
      ctx.font = "12px sans-serif";
      ctx.fillText(col.label, col.startX + 10, 25);
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

    // Draw edges
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        const fromX = sourceNode.position.x + 160;
        const fromY = sourceNode.position.y + 60;
        const toX = targetNode.position.x;
        const toY = targetNode.position.y + 60;
        drawArrow(ctx, fromX, fromY, toX, toY, "#4a7c7e");
        
        // Draw AND/OR logic badge on edge if present
        if (edge.data?.logic) {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const logic = edge.data.logic.toUpperCase();
          
          // Draw circle badge
          ctx.fillStyle = logic === "AND" ? "#6366f1" : "#f59e0b";
          ctx.beginPath();
          ctx.arc(midX, midY, 12, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(logic, midX, midY);
        }
      }
    });

    // Draw connection in progress
    if (connectionStart) {
      const startNode = nodes.find((n) => n.id === connectionStart);
      if (startNode) {
        const fromX = startNode.position.x + 160;
        const fromY = startNode.position.y + 60;
        ctx.strokeStyle = "#4a7c7e";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [nodes, edges, connectionStart, mousePos]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    if (draggingNode && containerRef.current) {
      const node = nodes.find((n) => n.id === draggingNode);
      if (node) {
        const newPos = {
          x: x - dragOffset.x,
          y: y - dragOffset.y,
        };
        // Constrain to column boundaries
        const constrainedPos = constrainPositionToColumn(newPos.x, newPos.y, node.stage);
        onNodeMove(draggingNode, constrainedPos);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Check if clicked on a handle
    const target = e.target as HTMLElement;
    const handleType = target.getAttribute("data-handle-type");
    const nodeId = target.getAttribute("data-node-id");
    
    if (handleType === "output" && nodeId) {
      // Start connection from output handle
      setConnectionStart(nodeId);
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

    if (connectionStart) {
      // Check if released on an input handle
      const target = e.target as HTMLElement;
      const handleType = target.getAttribute("data-handle-type");
      const targetNodeId = target.getAttribute("data-node-id");
      
      if (handleType === "input" && targetNodeId && targetNodeId !== connectionStart) {
        onEdgeCreate(connectionStart, targetNodeId);
        setConnectionStart(null);
        return;
      }

      setConnectionStart(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;

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
          
          const x1 = sourceNode.position.x + 160;
          const y1 = sourceNode.position.y + 60;
          const x2 = targetNode.position.x;
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
        return;
      }
      
      // Check if drop is within the stage's column
      const col = columns[stage as NodeStage];
      if (x >= col.startX && x < col.startX + col.width) {
        const constrainedPos = constrainPositionToColumn(x - 80, y, stage as NodeStage);
        onNodeDrop(nodeType, stage as NodeStage, constrainedPos);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#0a0a0a] relative overflow-hidden cursor-default"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        width={1400}
        height={800}
      />

      {/* Nodes rendered on top */}
      {nodes.map((node) => (
        <WorkflowNode
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          onSelect={onNodeSelect}
          onDelete={onNodeDelete}
        />
      ))}

      {/* Help text */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-600">
            <p className="text-lg mb-2">Drag nodes from the library to get started</p>
            <p className="text-sm">Right-click nodes to connect them</p>
          </div>
        </div>
      )}
    </div>
  );
}
