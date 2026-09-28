import { createClient } from "@/lib/supabase/server";
import type { MapRecord, Workspace } from "@/lib/types";
import { WorkspaceClient } from "./workspace-client";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at");

  const { data: maps } = await supabase
    .from("maps")
    .select("*")
    .order("created_at");

  return (
    <WorkspaceClient
      email={user?.email ?? ""}
      workspaces={(workspaces ?? []) as Workspace[]}
      maps={(maps ?? []) as MapRecord[]}
    />
  );
}
