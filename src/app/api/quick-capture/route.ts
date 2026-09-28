import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUSTER_COLOR, INBOX_LABEL } from "@/lib/yjs/codec";

const captureSchema = z.object({
  text: z.string().min(1).max(2000),
  workspace: z.enum(["work", "personal"]),
  parentId: z.string().uuid().optional(),
  type: z.string().optional(),
});

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = captureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const tokenHash = await sha256hex(token);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("api_tokens")
    .select("id, user_id, workspace_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  void supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const userId = tokenRow.user_id;

  let workspaceId = tokenRow.workspace_id;
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("type", parsed.data.workspace)
      .eq("created_by", userId)
      .limit(1)
      .maybeSingle();

    if (workspace) {
      workspaceId = workspace.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("workspaces")
        .insert({
          name: parsed.data.workspace === "work" ? "Work" : "Personal",
          type: parsed.data.workspace,
          created_by: userId,
        })
        .select("id")
        .single();
      if (createError || !created) {
        return NextResponse.json(
          { error: "Failed to resolve workspace" },
          { status: 500 },
        );
      }
      workspaceId = created.id;
    }
  }

  const { data: mapRow } = await supabase
    .from("maps")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let mapId = mapRow?.id;
  if (!mapId) {
    const { data: created, error: createError } = await supabase
      .from("maps")
      .insert({
        workspace_id: workspaceId,
        title: "Main Board",
        created_by: userId,
      })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: "Failed to resolve map" },
        { status: 500 },
      );
    }
    mapId = created.id;
  }

  let parentId = parsed.data.parentId ?? null;
  let position = { x: 0, y: 0 };
  let inbox = false;

  if (parentId) {
    const { data: parent } = await supabase
      .from("nodes")
      .select("position_x, position_y")
      .eq("id", parentId)
      .maybeSingle();
    if (parent) {
      position = { x: parent.position_x + 300, y: parent.position_y };
    }
  } else {
    const { data: inboxCluster } = await supabase
      .from("nodes")
      .select("id")
      .eq("map_id", mapId)
      .eq("kind", "cluster")
      .eq("label", INBOX_LABEL)
      .limit(1)
      .maybeSingle();

    let inboxId = inboxCluster?.id;
    if (!inboxId) {
      const { data: created, error: createError } = await supabase
        .from("nodes")
        .insert({
          map_id: mapId,
          kind: "cluster",
          label: INBOX_LABEL,
          color: CLUSTER_COLOR,
          position_x: -420,
          position_y: 0,
          created_by: userId,
        })
        .select("id")
        .single();
      if (createError || !created) {
        return NextResponse.json(
          { error: "Failed to create inbox" },
          { status: 500 },
        );
      }
      inboxId = created.id;
    }
    parentId = inboxId;
    inbox = true;

    const { count } = await supabase
      .from("edges")
      .select("id", { count: "exact", head: true })
      .eq("source", inboxId);

    const childIndex = count ?? 0;
    position = {
      x: -120 + Math.floor(childIndex / 8) * 240,
      y: (childIndex % 8) * 90 - 315,
    };
  }

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .insert({
      map_id: mapId,
      parent_id: parentId,
      kind: "node",
      label: parsed.data.text,
      position_x: position.x,
      position_y: position.y,
      inbox,
      created_by: userId,
    })
    .select("id")
    .single();

  if (nodeError || !node) {
    return NextResponse.json(
      { error: "Failed to create node" },
      { status: 500 },
    );
  }

  await supabase.from("edges").insert({
    map_id: mapId,
    source: parentId,
    target: node.id,
  });

  return NextResponse.json({
    id: node.id,
    map_id: mapId,
    parent_id: parentId,
  });
}
