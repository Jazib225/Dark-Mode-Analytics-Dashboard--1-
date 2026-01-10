import { ValidationError, WorkflowSchema, NodeStage } from "./types";

// Stage progression rules
const stageOrder: NodeStage[] = ["market", "entry", "exit", "profit"];

function getStageIndex(stage: NodeStage): number {
  return stageOrder.indexOf(stage);
}

export function validateWorkflow(schema: WorkflowSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that all required stages have at least one node (optional - stages can be skipped)
  // For now, we just validate edge connections

  // Validate edges follow stage order
  for (const edge of schema.edges) {
    const sourceNode = schema.nodes.find((n) => n.id === edge.source);
    const targetNode = schema.nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    const sourceStage = sourceNode.stage;
    const targetStage = targetNode.stage;

    // For operator nodes (and/or/math), they can connect within the same stage
    if (sourceNode.type !== "and" && sourceNode.type !== "or" && 
        !isOperator(sourceNode.type) && !isOperator(targetNode.type)) {
      // Normal stage nodes must follow order
      const sourceIdx = getStageIndex(sourceStage);
      const targetIdx = getStageIndex(targetStage);

      if (targetIdx <= sourceIdx && sourceStage !== targetStage) {
        errors.push({
          type: "invalid_edge",
          message: `${targetStage.charAt(0).toUpperCase() + targetStage.slice(1)} stage cannot connect backward to ${sourceStage} stage`,
          nodeId: edge.id,
        });
      }
    }
  }

  return errors;
}

function isOperator(nodeType: string): boolean {
  return ["and", "or", "add", "subtract", "multiply", "divide"].includes(nodeType);
}

export function canConnect(sourceType: string, targetType: string, sourceStage: NodeStage, targetStage: NodeStage): boolean {
  // Operator nodes can connect within same stage
  if (isOperator(sourceType) || isOperator(targetType)) {
    return sourceStage === targetStage;
  }

  // Regular stage nodes follow order
  const sourceIdx = getStageIndex(sourceStage);
  const targetIdx = getStageIndex(targetStage);

  return targetIdx > sourceIdx || sourceStage === targetStage;
}

export function buildExpressionPreview(nodeId: string, nodes: any[]): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return "";

  // For operator nodes, show expression
  if (node.type === "and") return "AND";
  if (node.type === "or") return "OR";
  if (node.type === "add") return "+";
  if (node.type === "subtract") return "-";
  if (node.type === "multiply") return "*";
  if (node.type === "divide") return "/";

  // For condition nodes, show field/operator/value
  const data = node.data as any;
  if (data.field && data.operator && data.value !== undefined) {
    return `${data.field} ${data.operator} ${data.value}`;
  }

  return `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node`;
}
