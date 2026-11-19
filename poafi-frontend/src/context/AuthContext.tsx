"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, SESSION_META_KEY } from "@/lib/api";

type User = { id: string; email: string; role: string; tenantId?: string };

interface SessionMeta {
  loginDay: string;
  lastActivity: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (tokenOrUser: string | User, maybeUser?: User) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes inactivity timeout

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayKeyFromMs(ms?: number): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const lastTouchRef = useRef<number>(0);

  const performLogout = useCallback(
    async (redirectToLogin = true) => {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("poafi_token");
        localStorage.removeItem("poafi_user");
        sessionStorage.removeItem(SESSION_META_KEY);
      }
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } catch {
        /* cookie may already be absent */
      }
      if (redirectToLogin) {
        router.push("/login");
      }
    },
    [router],
  );

  // Verify active HttpOnly session cookie with backend on initial mount
  useEffect(() => {
    let active = true;

    async function verifySession() {
      // Purge any legacy persistent localStorage credentials from older versions
      localStorage.removeItem("poafi_token");
      localStorage.removeItem("poafi_user");

      try {
        const metaRaw = sessionStorage.getItem(SESSION_META_KEY);
        if (metaRaw) {
          const meta: SessionMeta = JSON.parse(metaRaw);
          if (meta.loginDay !== todayKey() || Date.now() - meta.lastActivity > IDLE_TIMEOUT_MS) {
            await performLogout(false);
            if (active) setIsLoading(false);
            return;
          }
        }

        const res = await apiFetch("/auth/me");
        const issuedDay = dayKeyFromMs(res.sessionIssuedAt);

        // Enforce re-login on a new calendar day even if the browser restored tabs/cookies
        if (issuedDay && issuedDay !== todayKey()) {
          await performLogout(false);
          if (active) setIsLoading(false);
          return;
        }

        if (active && res.user) {
          setUser(res.user);
          sessionStorage.setItem(
            SESSION_META_KEY,
            JSON.stringify({ loginDay: issuedDay || todayKey(), lastActivity: Date.now() }),
          );
        }
      } catch {
        if (active) {
          setUser(null);
          sessionStorage.removeItem(SESSION_META_KEY);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [performLogout]);

  // Enforce route guards
  useEffect(() => {
    if (!isLoading) {
      const publicPaths = ["/", "/login", "/portal", "/about", "/contact", "/guide", "/register"];
      const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith("/portal");

      if (!user && !isPublicPath) {
        router.push("/login");
      }
      if (user && pathname === "/login") {
        router.push("/dashboard");
      }
    }
  }, [user, isLoading, pathname, router]);

  // Track user activity & enforce idle / next-day auto-logout while browser is open
  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < 30_000) return;
      lastTouchRef.current = now;
      try {
        const raw = sessionStorage.getItem(SESSION_META_KEY);
        const meta: SessionMeta = raw ? JSON.parse(raw) : { loginDay: todayKey(), lastActivity: now };
        if (meta.loginDay !== todayKey()) {
          performLogout(true);
          return;
        }
        meta.lastActivity = now;
        sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
    };

    const checkSessionFreshness = () => {
      try {
        const raw = sessionStorage.getItem(SESSION_META_KEY);
        if (!raw) return;
        const meta: SessionMeta = JSON.parse(raw);
        if (meta.loginDay !== todayKey() || Date.now() - meta.lastActivity > IDLE_TIMEOUT_MS) {
          performLogout(true);
        }
      } catch {
        performLogout(true);
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkSessionFreshness);
    const interval = setInterval(checkSessionFreshness, 60_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      document.removeEventListener("visibilitychange", checkSessionFreshness);
      clearInterval(interval);
    };
  }, [user, performLogout]);

  const login = (tokenOrUser: string | User, maybeUser?: User) => {
    // JWT lives strictly in the server-issued HttpOnly session cookie; never store it in JS storage.
    const nextUser = typeof tokenOrUser === "string" ? maybeUser : tokenOrUser;
    if (!nextUser) return;
    localStorage.removeItem("poafi_token");
    localStorage.removeItem("poafi_user");
    sessionStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({ loginDay: todayKey(), lastActivity: Date.now() }),
    );
    setUser(nextUser);
    router.push("/dashboard");
  };

  const logout = () => performLogout(true);

  return (
    <AuthContext.Provider value={{ user, token: null, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
