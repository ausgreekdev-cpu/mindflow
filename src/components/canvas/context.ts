"use client";

import { createContext, useContext } from "react";

export type MindMapContextValue = {
  updateNodeLabel: (id: string, label: string) => void;
  addChild: (parentId: string) => void;
  addSibling: (id: string) => void;
  removeNode: (id: string) => void;
  requestEdit: (id: string) => void;
  clearEdit: (id: string) => void;
};

export const MindMapContext = createContext<MindMapContextValue | null>(null);

export function useMindMapContext() {
  const ctx = useContext(MindMapContext);
  if (!ctx) {
    throw new Error("useMindMapContext must be used within a MindMap provider");
  }
  return ctx;
}
