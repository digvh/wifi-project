const API_URL = "http://127.0.0.1:4000/api";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("poafi_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Check if the response is actually JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server Error: Route ${endpoint} returned HTML instead of JSON. Check backend terminal.`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}