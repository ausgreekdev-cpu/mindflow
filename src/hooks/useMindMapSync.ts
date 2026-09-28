"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import YPartyKitProvider from "y-partykit/provider";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { createClient } from "@/lib/supabase/client";
import type {
  MindMapEdgeRecord,
  MindMapNodeRecord,
  WorkspaceType,
} from "@/lib/types";
import {
  CLUSTER_COLOR,
  PERSONAL_COLOR,
  WORK_COLOR,
  recordToEdge,
  recordToNode,
  type YEdgeRecord,
  type YNodeRecord,
} from "@/lib/yjs/codec";

export type MindMapSyncOptions = {
  mapId: string;
  workspaceType: WorkspaceType;
  userId: string;
  userName: string;
  userColor: string;
  partykitHost: string;
  initialNodes: MindMapNodeRecord[];
  initialEdges: MindMapEdgeRecord[];
};

function dbNodeToRecord(
  n: MindMapNodeRecord,
  fallbackColor: string,
): YNodeRecord {
  return {
    id: n.id,
    parentId: n.parent_id,
    x: n.position_x,
    y: n.position_y,
    label: n.label,
    color: n.color ?? fallbackColor,
    kind: n.kind,
    inbox: n.inbox,
    createdBy: n.created_by,
    updatedAt: Date.parse(n.updated_at),
  };
}

function dbEdgeToRecord(e: MindMapEdgeRecord): YEdgeRecord {
  return { id: e.id, source: e.source, target: e.target };
}

export function useMindMapSync(options: MindMapSyncOptions) {
  const {
    mapId,
    workspaceType,
    userId,
    userName,
    userColor,
    partykitHost,
    initialNodes,
    initialEdges,
  } = options;

  const baseColor =
    workspaceType === "work" ? WORK_COLOR : PERSONAL_COLOR;

  const [doc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new Awareness(doc));

  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);

  const [nodes, setNodes] = useState<Node[]>(() =>
    initialNodes.map((n) => recordToNode(dbNodeToRecord(n, baseColor))),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    initialEdges.map(dbEdgeToRecord).map(recordToEdge),
  );

  const syncFromDoc = useCallback(() => {
    const nodesMap = doc.getMap<YNodeRecord>("nodes");
    const edgesMap = doc.getMap<YEdgeRecord>("edges");

    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      const next = Array.from(nodesMap.values()).map(recordToNode);
      return next.map((n) => {
        const prevNode = prevById.get(n.id);
        if (prevNode) {
          n.selected = prevNode.selected;
          n.dragging = prevNode.dragging;
          n.measured = prevNode.measured;
          n.width = prevNode.width;
          n.height = prevNode.height;
        }
        return n;
      });
    });

    setEdges(Array.from(edgesMap.values()).map(recordToEdge));
  }, [doc]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const edgesMap = doc.getMap<YEdgeRecord>("edges");

      const nodeRows = Array.from(nodesMap.values()).map((r) => ({
        id: r.id,
        map_id: mapId,
        parent_id: r.parentId,
        kind: r.kind,
        label: r.label,
        position_x: r.x,
        position_y: r.y,
        color: r.color,
        inbox: r.inbox,
        created_by: r.createdBy,
        updated_at: new Date(r.updatedAt).toISOString(),
      }));
      const edgeRows = Array.from(edgesMap.values()).map((r) => ({
        id: r.id,
        map_id: mapId,
        source: r.source,
        target: r.target,
      }));

      if (nodeRows.length > 0) {
        await supabase.from("nodes").upsert(nodeRows, { onConflict: "id" });
      }
      if (edgeRows.length > 0) {
        await supabase.from("edges").upsert(edgeRows, { onConflict: "id" });
      }
    }, 2000);
  }, [doc, mapId]);

  useEffect(() => {
    const nodesMap = doc.getMap<YNodeRecord>("nodes");
    const edgesMap = doc.getMap<YEdgeRecord>("edges");

    if (nodesMap.size === 0 && edgesMap.size === 0) {
      doc.transact(() => {
        for (const n of initialNodes) {
          nodesMap.set(n.id, dbNodeToRecord(n, baseColor));
        }
        for (const e of initialEdges) {
          edgesMap.set(e.id, dbEdgeToRecord(e));
        }
      });
    }

    const nodesObserver = () => {
      syncFromDoc();
      persist();
    };
    const edgesObserver = () => {
      syncFromDoc();
      persist();
    };
    nodesMap.observe(nodesObserver);
    edgesMap.observe(edgesObserver);

    awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      workspace: workspaceType,
    });

    const provider = new YPartyKitProvider(partykitHost, `map:${mapId}`, doc, {
      awareness,
    });
    provider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected");
    });
    provider.on("synced", () => setSynced(true));

    return () => {
      nodesMap.unobserve(nodesObserver);
      edgesMap.unobserve(edgesObserver);
      provider.destroy();
      setConnected(false);
      setSynced(false);
    };
  }, [
    doc,
    mapId,
    awareness,
    syncFromDoc,
    persist,
    baseColor,
    userName,
    userColor,
    workspaceType,
    partykitHost,
    initialNodes,
    initialEdges,
  ]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const edgesMap = doc.getMap<YEdgeRecord>("edges");

      doc.transact(() => {
        for (const change of changes) {
          if (change.type === "position" && change.position) {
            const record = nodesMap.get(change.id);
            if (record) {
              nodesMap.set(change.id, {
                ...record,
                x: change.position.x,
                y: change.position.y,
                updatedAt: Date.now(),
              });
            }
          } else if (change.type === "remove") {
            nodesMap.delete(change.id);
            edgesMap.forEach((e, eid) => {
              if (e.source === change.id || e.target === change.id) {
                edgesMap.delete(eid);
              }
            });
          }
        }
      });

      setNodes((prev) => applyNodeChanges(changes, prev));
    },
    [doc],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const edgesMap = doc.getMap<YEdgeRecord>("edges");

      doc.transact(() => {
        for (const change of changes) {
          if (change.type === "remove") {
            edgesMap.delete(change.id);
          }
        }
      });

      setEdges((prev) => applyEdgeChanges(changes, prev));
    },
    [doc],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edgesMap = doc.getMap<YEdgeRecord>("edges");
      const id = crypto.randomUUID();
      doc.transact(() => {
        edgesMap.set(id, {
          id,
          source: connection.source,
          target: connection.target,
        });
      });
    },
    [doc],
  );

  const addNode = useCallback(
    (opts: {
      parentId?: string | null;
      label?: string;
      kind?: "cluster" | "node";
      inbox?: boolean;
    }): string => {
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const edgesMap = doc.getMap<YEdgeRecord>("edges");

      const id = crypto.randomUUID();
      const parentId = opts.parentId ?? null;
      const parent = parentId ? nodesMap.get(parentId) : null;

      const siblings = Array.from(edgesMap.values()).filter(
        (e) => e.source === parentId,
      ).length;

      const x = parent ? parent.x + 300 : siblings * 320;
      const y = parent
        ? parent.y + (siblings - (siblings === 0 ? 0 : (siblings - 1) / 2)) * 90
        : 0;

      const record: YNodeRecord = {
        id,
        parentId,
        x,
        y,
        label: opts.label ?? "",
        color: opts.kind === "cluster" ? CLUSTER_COLOR : baseColor,
        kind: opts.kind ?? "node",
        inbox: opts.inbox ?? false,
        createdBy: userId,
        updatedAt: Date.now(),
      };

      doc.transact(() => {
        nodesMap.set(id, record);
        if (parentId) {
          const eid = crypto.randomUUID();
          edgesMap.set(eid, { id: eid, source: parentId, target: id });
        }
      });

      persist();
      return id;
    },
    [doc, baseColor, userId, persist],
  );

  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const record = nodesMap.get(id);
      if (record) {
        nodesMap.set(id, { ...record, label, updatedAt: Date.now() });
        persist();
      }
    },
    [doc, persist],
  );

  const removeNode = useCallback(
    (id: string) => {
      const supabase = createClient();
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const edgesMap = doc.getMap<YEdgeRecord>("edges");

      doc.transact(() => {
        nodesMap.delete(id);
        edgesMap.forEach((e, eid) => {
          if (e.source === id || e.target === id) {
            edgesMap.delete(eid);
          }
        });
      });

      void supabase.from("nodes").delete().eq("id", id);
    },
    [doc],
  );

  const addChild = useCallback(
    (parentId: string) => addNode({ parentId }),
    [addNode],
  );

  const addSibling = useCallback(
    (id: string) => {
      const nodesMap = doc.getMap<YNodeRecord>("nodes");
      const record = nodesMap.get(id);
      return addNode({ parentId: record?.parentId ?? null });
    },
    [doc, addNode],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addChild,
    addSibling,
    updateNodeLabel,
    removeNode,
    connected,
    synced,
    awareness,
  };
}
