export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;
    const isLocalDev =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      port === "3000";
    if (isLocalDev) {
      return `${protocol}//${hostname}:4000/api`;
    }
    // On shared hosting (port 80/443), default to same-origin /api
    return `${origin}/api`;
  }
  return "http://127.0.0.1:4000/api";
}

export const SESSION_META_KEY = "poafi_session_meta";

function clearClientSessionIfNeeded(endpoint: string, status: number) {
  if (typeof window === "undefined") return;
  if (status !== 401 || endpoint.startsWith("/auth/login")) return;

  localStorage.removeItem("poafi_token");
  localStorage.removeItem("poafi_user");
  sessionStorage.removeItem(SESSION_META_KEY);

  if (endpoint === "/auth/me") return;

  const publicPaths = ["/", "/login", "/portal", "/about", "/contact", "/guide", "/register"];
  const path = window.location.pathname;
  const isPublic = publicPaths.includes(path) || path.startsWith("/portal");
  if (!isPublic) {
    window.location.replace("/login");
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "PoaFi-Web",
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${getApiUrl()}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  // Check if the response is actually JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server Error: Route ${endpoint} returned HTML instead of JSON. Check backend terminal.`);
  }

  const data = await response.json();

  if (!response.ok) {
    clearClientSessionIfNeeded(endpoint, response.status);
    throw new Error(data.error || "Something went wrong");
  }

  // Refresh idle activity timestamp on successful API activity
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_META_KEY);
      if (raw) {
        const meta = JSON.parse(raw);
        meta.lastActivity = Date.now();
        sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
      }
    } catch {
      /* ignore storage errors */
    }
  }

  return data;
}
