"use client";

import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import type { Awareness } from "y-protocols/awareness";

type CursorData = { name: string; color: string };

type PresenceUser = { name: string; color: string; workspace: string };
type PresenceCursor = { x: number; y: number };

export function usePresence(awareness: Awareness | null) {
  const [cursorNodes, setCursorNodes] = useState<Node<CursorData, "cursor">[]>(
    [],
  );

  useEffect(() => {
    if (!awareness) return;

    const update = () => {
      const states = awareness.getStates() as Map<
        number,
        { user?: PresenceUser; cursor?: PresenceCursor }
      >;
      const localId = awareness.clientID;
      const next: Node<CursorData, "cursor">[] = [];

      states.forEach((state, clientId) => {
        if (clientId === localId) return;
        if (!state.cursor || !state.user) return;
        next.push({
          id: `cursor-${clientId}`,
          type: "cursor",
          position: { x: state.cursor.x, y: state.cursor.y },
          data: { name: state.user.name, color: state.user.color },
          draggable: false,
          selectable: false,
          connectable: false,
          deletable: false,
          zIndex: 1000,
        });
      });

      setCursorNodes(next);
    };

    update();
    awareness.on("change", update);
    return () => {
      awareness.off("change", update);
    };
  }, [awareness]);

  return cursorNodes;
}
