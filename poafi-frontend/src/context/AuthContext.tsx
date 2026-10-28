"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type User = { id: string; email: string; role: string; tenantId?: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedToken = localStorage.getItem("poafi_token");
    const savedUser = localStorage.getItem("poafi_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Define public paths that don't require login
      const publicPaths = ["/", "/login", "/portal", "/about", "/contact", "/guide", "/register"];
      const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith("/portal");

      if (!token && !isPublicPath) {
        router.push("/login");
      }
      if (token && pathname === "/login") {
        router.push("/dashboard");
      }
    }
  }, [token, isLoading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("poafi_token", newToken);
    localStorage.setItem("poafi_user", JSON.stringify(newUser));
    router.push("/dashboard");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("poafi_token");
    localStorage.removeItem("poafi_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
