"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Inbox } from "lucide-react";
import { useMindMapContext } from "./context";
import type { MindNodeType } from "@/lib/yjs/codec";

export function MindMapNode({ id, data, selected, type }: NodeProps<MindNodeType>) {
  const { updateNodeLabel, addChild, clearEdit } = useMindMapContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data.label ?? ""));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(false);

  const isCluster = type === "cluster";
  const accent = data.color ?? "#94a3b8";

  useEffect(() => {
    const pending = Boolean(data.pendingEdit);
    if (pending && !pendingRef.current) {
      setDraft(String(data.label ?? ""));
      setEditing(true);
    }
    pendingRef.current = pending;
  }, [data.pendingEdit, data.label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== data.label) {
      updateNodeLabel(id, value);
    }
    clearEdit(id);
  }, [draft, data.label, id, updateNodeLabel, clearEdit]);

  const startEditing = useCallback(() => {
    setDraft(String(data.label ?? ""));
    setEditing(true);
  }, [data.label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        commit();
        addChild(id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
        setDraft(String(data.label ?? ""));
      }
    },
    [commit, addChild, id, data.label],
  );

  if (editing) {
    return (
      <div
        className="relative rounded-xl border-2 bg-white shadow-md"
        style={{ borderColor: accent }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border-0 !bg-slate-400"
        />
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={1}
          className="nodrag nopan nowheel block w-44 resize-none rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-slate-800 outline-none"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-0 !bg-slate-400"
        />
      </div>
    );
  }

  if (isCluster) {
    return (
      <div className="group relative">
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-0 !bg-amber-500"
        />
        <button
          type="button"
          onDoubleClick={startEditing}
          className="flex items-center gap-2 rounded-full border-2 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition-shadow hover:shadow-md"
          style={{ borderColor: accent }}
        >
          <Inbox className="h-4 w-4" />
          {data.label}
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-slate-400"
      />
      <button
        type="button"
        onDoubleClick={startEditing}
        className={`rounded-xl border-2 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-shadow hover:shadow-md ${
          selected ? "shadow-lg ring-2 ring-slate-300" : ""
        }`}
        style={{ borderColor: accent }}
      >
        {data.label || "New idea"}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-slate-400"
      />
    </div>
  );
}
