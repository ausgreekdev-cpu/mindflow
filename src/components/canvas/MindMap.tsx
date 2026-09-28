"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeTypes,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMindMapSync } from "@/hooks/useMindMapSync";
import { usePresence } from "@/hooks/usePresence";
import type {
  MindMapEdgeRecord,
  MindMapNodeRecord,
  WorkspaceType,
} from "@/lib/types";
import { ROOT_LABEL } from "@/lib/yjs/codec";
import { MindMapContext, type MindMapContextValue } from "./context";
import { MindMapNode } from "./MindMapNode";
import { CursorNode } from "./CursorNode";
import { Toolbar } from "./Toolbar";

const nodeTypes: NodeTypes = {
  mind: MindMapNode,
  cluster: MindMapNode,
  cursor: CursorNode,
};

export type MindMapProps = {
  mapId: string;
  workspaceType: WorkspaceType;
  userId: string;
  userName: string;
  userColor: string;
  partykitHost: string;
  initialNodes: MindMapNodeRecord[];
  initialEdges: MindMapEdgeRecord[];
};

export function MindMap(props: MindMapProps) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
}

function MindMapInner({
  mapId,
  workspaceType,
  userId,
  userName,
  userColor,
  partykitHost,
  initialNodes,
  initialEdges,
}: MindMapProps) {
  const { screenToFlowPosition } = useReactFlow();
  const sync = useMindMapSync({
    mapId,
    workspaceType,
    userId,
    userName,
    userColor,
    partykitHost,
    initialNodes,
    initialEdges,
  });

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addChild: syncAddChild,
    addSibling: syncAddSibling,
    removeNode: syncRemoveNode,
    updateNodeLabel,
    connected,
    synced,
    awareness,
  } = sync;

  const cursorNodes = usePresence(awareness);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  const addChild = useCallback(
    (parentId: string) => {
      const id = syncAddChild(parentId);
      setSelectedId(id);
      setPendingEditId(id);
    },
    [syncAddChild],
  );

  const addSibling = useCallback(
    (id: string) => {
      const nextId = syncAddSibling(id);
      setSelectedId(nextId);
      setPendingEditId(nextId);
    },
    [syncAddSibling],
  );

  const removeNode = useCallback(
    (id: string) => {
      syncRemoveNode(id);
      setSelectedId(null);
    },
    [syncRemoveNode],
  );

  const addRoot = useCallback(() => {
    const id = addNode({ label: ROOT_LABEL });
    setSelectedId(id);
    setPendingEditId(id);
  }, [addNode]);

  const contextValue = useMemo<MindMapContextValue>(
    () => ({
      updateNodeLabel,
      addChild,
      addSibling,
      removeNode,
      requestEdit: (id) => setPendingEditId(id),
      clearEdit: (id) =>
        setPendingEditId((prev) => (prev === id ? null : prev)),
    }),
    [updateNodeLabel, addChild, addSibling, removeNode],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      setSelectedId(selected[0]?.id ?? null);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (selectedId) addChild(selectedId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedId) addSibling(selectedId);
      } else if (e.key === "F2") {
        e.preventDefault();
        if (selectedId) setPendingEditId(selectedId);
      }
    },
    [selectedId, addChild, addSibling],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!awareness) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      awareness.setLocalStateField("cursor", {
        x: position.x,
        y: position.y,
      });
    },
    [awareness, screenToFlowPosition],
  );

  const displayNodes = useMemo<Node[]>(() => {
    const dataNodes = nodes.map((n) =>
      n.id === pendingEditId
        ? { ...n, data: { ...n.data, pendingEdit: true } }
        : n,
    );
    return [...dataNodes, ...cursorNodes];
  }, [nodes, cursorNodes, pendingEditId]);

  return (
    <MindMapContext.Provider value={contextValue}>
      <div className="h-full w-full">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onPointerMove={handlePointerMove}
          onPaneClick={() => setPendingEditId(null)}
          fitView
          minZoom={0.1}
          maxZoom={2.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.data as { color?: string }).color ?? "#94a3b8"}
          />
          <Panel position="top-left">
            <Toolbar
              workspaceType={workspaceType}
              connected={connected}
              synced={synced}
              onAddRoot={addRoot}
            />
          </Panel>
        </ReactFlow>
      </div>
    </MindMapContext.Provider>
  );
}
