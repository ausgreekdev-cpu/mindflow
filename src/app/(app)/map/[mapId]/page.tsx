import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MindMap } from "@/components/canvas/MindMap";
import type { MindMapEdgeRecord, MindMapNodeRecord } from "@/lib/types";

const PRESENCE_PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (const c of id) {
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  }
  return PRESENCE_PALETTE[hash % PRESENCE_PALETTE.length];
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ mapId: string }>;
}) {
  const { mapId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: map } = await supabase
    .from("maps")
    .select("id, workspace_id, title")
    .eq("id", mapId)
    .maybeSingle();
  if (!map) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, type")
    .eq("id", map.workspace_id)
    .maybeSingle();

  const { data: nodes } = await supabase
    .from("nodes")
    .select("*")
    .eq("map_id", mapId)
    .order("created_at");

  const { data: edges } = await supabase
    .from("edges")
    .select("*")
    .eq("map_id", mapId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "You";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Workspaces
          </Link>
          <span className="h-4 w-px bg-slate-200" />
          <span className="text-sm font-medium">{map.title}</span>
          {workspace && (
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                workspace.type === "work"
                  ? "bg-blue-500"
                  : "bg-emerald-500"
              }`}
            />
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <MindMap
          key={mapId}
          mapId={mapId}
          workspaceType={workspace?.type ?? "personal"}
          userId={user.id}
          userName={userName}
          userColor={colorFromId(user.id)}
          partykitHost={
            process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999"
          }
          initialNodes={(nodes ?? []) as MindMapNodeRecord[]}
          initialEdges={(edges ?? []) as MindMapEdgeRecord[]}
        />
      </div>
    </div>
  );
}
