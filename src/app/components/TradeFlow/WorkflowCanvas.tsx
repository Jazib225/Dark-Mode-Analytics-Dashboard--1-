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
  onCanvasClick: () => void;
  draggedNodeType?: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
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
  onCanvasClick,
  draggedNodeType,
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
      onNodeMove(draggingNode, {
        x: x - dragOffset.x,
        y: y - dragOffset.y,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
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
      if (e.button === 2 || e.ctrlKey) {
        // Right click or Ctrl+click to start connection
        setConnectionStart(connectionStart === clickedNodeId ? null : clickedNodeId);
      } else {
        // Left click to select and drag
        onNodeSelect(clickedNodeId);
        setDraggingNode(clickedNodeId);
        const node = nodes.find((n) => n.id === clickedNodeId)!;
        setDragOffset({ x: x - node.position.x, y: y - node.position.y });
      }
    } else {
      onCanvasClick();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    setDraggingNode(null);

    if (connectionStart) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if released on a node
      for (const node of nodes) {
        if (node.id !== connectionStart && pointInRect(x, y, getNodeRect(node))) {
          onEdgeCreate(connectionStart, node.id);
          setConnectionStart(null);
          return;
        }
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

      onNodeDrop(nodeType, stage as NodeStage, { x, y });
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
      onContextMenu={(e) => e.preventDefault()}
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
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDraggingNode(node.id);
          }}
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
