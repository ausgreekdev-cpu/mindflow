"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, KeyRound, LogOut, Map as MapIcon, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MapRecord, Workspace, WorkspaceType } from "@/lib/types";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type WorkspaceClientProps = {
  email: string;
  workspaces: Workspace[];
  maps: MapRecord[];
};

export function WorkspaceClient({
  email,
  workspaces,
  maps,
}: WorkspaceClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [newToken, setNewToken] = useState<string | null>(null);

  const mapsByWorkspace = useMemo(() => {
    const grouped: Record<string, MapRecord[]> = {};
    for (const m of maps) {
      (grouped[m.workspace_id] ??= []).push(m);
    }
    return grouped;
  }, [maps]);

  async function createWorkspace(name: string, type: WorkspaceType) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("workspaces")
      .insert({ name, type, created_by: user.id });
    router.refresh();
  }

  async function createMap(workspaceId: string, title: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("maps")
      .insert({ workspace_id: workspaceId, title, created_by: user.id });
    router.refresh();
  }

  async function generateToken(workspaceId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const token = randomToken();
    const hash = await sha256hex(token);
    await supabase.from("api_tokens").insert({
      user_id: user.id,
      workspace_id: workspaceId,
      name: "quick-capture",
      token_hash: hash,
    });
    setNewToken(token);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <span className="font-semibold">MindFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{email}</span>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Workspaces</h1>
            <WorkspaceForm onCreate={createWorkspace} />
          </div>

          {newToken && (
            <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <KeyRound className="h-4 w-4" />
                Capture token created — copy it now
              </p>
              <code className="block break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-amber-900">
                {newToken}
              </code>
            </div>
          )}

          {workspaces.length === 0 ? (
            <p className="text-sm text-slate-500">
              No workspaces yet. Create one to get started.
            </p>
          ) : (
            <div className="grid gap-6">
              {workspaces.map((ws) => (
                <section
                  key={ws.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          ws.type === "work"
                            ? "bg-blue-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <h2 className="font-semibold">{ws.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500">
                        {ws.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateToken(ws.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Capture token
                    </button>
                  </div>

                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    {(mapsByWorkspace[ws.id] ?? []).map((map) => (
                      <Link
                        key={map.id}
                        href={`/map/${map.id}`}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <MapIcon className="h-4 w-4 text-slate-400" />
                        {map.title}
                      </Link>
                    ))}
                  </div>

                  <MapForm workspaceId={ws.id} onCreate={createMap} />
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function WorkspaceForm({
  onCreate,
}: {
  onCreate: (name: string, type: WorkspaceType) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("personal");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim(), type);
        setName("");
      }}
      className="flex items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New workspace name"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as WorkspaceType)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none"
      >
        <option value="personal">Personal</option>
        <option value="work">Work</option>
      </select>
      <button
        type="submit"
        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" />
        New
      </button>
    </form>
  );
}

function MapForm({
  workspaceId,
  onCreate,
}: {
  workspaceId: string;
  onCreate: (workspaceId: string, title: string) => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onCreate(workspaceId, title.trim());
        setTitle("");
      }}
      className="flex items-center gap-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New map name"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" />
        Map
      </button>
    </form>
  );
}
