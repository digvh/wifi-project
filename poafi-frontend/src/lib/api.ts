const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api").replace(/\/$/, "");

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // apiFetch is intended for browser-side authenticated requests because the current
  // authentication flow stores the bearer token in localStorage.
  if (typeof window === "undefined") {
    throw new Error("apiFetch must be called from the browser");
  }

  const token = window.localStorage.getItem("poafi_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server Error: Route ${endpoint} returned a non-JSON response. Check the API deployment and logs.`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}
