export type WorkspaceType = "personal" | "work";

export type MemberRole = "owner" | "partner" | "editor" | "viewer";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  created_by: string;
  created_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
};

export type MapRecord = {
  id: string;
  workspace_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type NodeKind = "cluster" | "node";

export type MindMapNodeRecord = {
  id: string;
  map_id: string;
  parent_id: string | null;
  kind: NodeKind;
  label: string;
  position_x: number;
  position_y: number;
  color: string | null;
  inbox: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MindMapEdgeRecord = {
  id: string;
  map_id: string;
  source: string;
  target: string;
  created_at: string;
};

export type QuickCapturePayload = {
  text: string;
  workspace: WorkspaceType;
  parentId?: string;
  type?: string;
};
