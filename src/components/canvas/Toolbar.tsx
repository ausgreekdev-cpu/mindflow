"use client";

import { useReactFlow } from "@xyflow/react";
import { Minus, Plus, PlusCircle, Scan } from "lucide-react";
import type { WorkspaceType } from "@/lib/types";
import { PERSONAL_COLOR, WORK_COLOR } from "@/lib/yjs/codec";

type ToolbarProps = {
  workspaceType: WorkspaceType;
  connected: boolean;
  synced: boolean;
  onAddRoot: () => void;
};

export function Toolbar({
  workspaceType,
  connected,
  synced,
  onAddRoot,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const accent = workspaceType === "work" ? WORK_COLOR : PERSONAL_COLOR;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur">
      <span
        className="ml-1 h-3 w-3 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="mr-1 text-sm font-semibold capitalize text-slate-700">
        {workspaceType}
      </span>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <button
        type="button"
        onClick={onAddRoot}
        title="Add root node"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <PlusCircle className="h-4 w-4" />
        Root
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <button
        type="button"
        onClick={() => zoomOut()}
        title="Zoom out"
        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        title="Zoom in"
        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => fitView({ padding: 0.2 })}
        title="Fit view"
        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <Scan className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <span
        className="mr-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium"
        title={synced ? "Live sync active" : connected ? "Connecting…" : "Offline"}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            synced ? "bg-emerald-500" : connected ? "bg-amber-400" : "bg-slate-300"
          }`}
        />
        {synced ? "Live" : connected ? "Syncing" : "Offline"}
      </span>
    </div>
  );
}
