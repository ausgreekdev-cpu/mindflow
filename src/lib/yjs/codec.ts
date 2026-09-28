import type { Edge, Node } from "@xyflow/react";

export const WORK_COLOR = "#3b82f6";
export const PERSONAL_COLOR = "#22c55e";
export const CLUSTER_COLOR = "#f59e0b";

export const INBOX_LABEL = "Unsorted Inbox";
export const ROOT_LABEL = "Central Idea";

export type MindNodeData = {
  label: string;
  color: string;
  inbox: boolean;
  pendingEdit?: boolean;
};

export type MindNodeType = Node<MindNodeData, "mind" | "cluster">;
export type MindEdgeType = Edge;

export type YNodeRecord = {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  label: string;
  color: string;
  kind: "cluster" | "node";
  inbox: boolean;
  createdBy: string;
  updatedAt: number;
};

export type YEdgeRecord = {
  id: string;
  source: string;
  target: string;
};

export function recordToNode(record: YNodeRecord): MindNodeType {
  return {
    id: record.id,
    type: record.kind === "cluster" ? "cluster" : "mind",
    position: { x: record.x, y: record.y },
    data: {
      label: record.label,
      color: record.color,
      inbox: record.inbox,
    },
  };
}

export function recordToEdge(record: YEdgeRecord): MindEdgeType {
  return {
    id: record.id,
    source: record.source,
    target: record.target,
  };
}
