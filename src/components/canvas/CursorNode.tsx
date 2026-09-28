"use client";

import type { Node, NodeProps } from "@xyflow/react";

type CursorData = { name: string; color: string };
export type CursorNodeType = Node<CursorData, "cursor">;

export function CursorNode({ data }: NodeProps<CursorNodeType>) {
  return (
    <div className="pointer-events-none relative">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={data.color}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" }}
      >
        <path d="M4 3l16 7.5-6.5 1.5L10 18.5 4 3z" />
      </svg>
      <span
        className="absolute left-4 top-3 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
        style={{ backgroundColor: data.color }}
      >
        {data.name}
      </span>
    </div>
  );
}
