const KEY = "randomconnect_user_id";

export function getUserId() {
  return localStorage.getItem(KEY) || "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-user-id", getUserId());
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`/api/v1${path}`, { ...init, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
  return response.json();
}

export async function getMe() {
  const user = await request<{id:string;displayName:string}>("/me");
  localStorage.setItem(KEY, user.id);
  return user;
}

export function updateName(displayName: string) {
  return request("/me", { method: "PATCH", body: JSON.stringify({ displayName }) });
}

export function joinMatchmaking() {
  return request("/matchmaking/join", { method: "POST" });
}

export function leaveMatchmaking() {
  return request("/matchmaking/leave", { method: "POST" });
}

export function getConversations() {
  return request<{ conversations: any[] }>("/conversations");
}

export function getConversation(id: string) {
  return request<any>(`/conversations/${id}`);
}

export function sendMessage(id: string, body: string) {
  return request(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
}

export function blockUser(id: string) {
  return request(`/users/${id}/block`, { method: "POST" });
}

export function reportUser(reportedUserId: string, reason: string, details?: string) {
  return request("/reports", { method: "POST", body: JSON.stringify({ reportedUserId, reason, details }) });
}
