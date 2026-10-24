import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/Loading";

const AuthContext = createContext(null);

export function AuthShell() {
  const [session, setSession] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setSession(data);
      return data;
    } catch (e) {
      setSession(false);
      return false;
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      /* cookies are cleared server-side when reachable */
    }
    setSession(false);
  }, []);
  return (
    <AuthContext.Provider value={{ session, setSession, refresh, logout }}>
      <Outlet />
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function homeFor(session) {
  if (!session) return "/login";
  if (session.user?.is_platform_admin && !session.membership) return "/admin";
  if (session.membership?.role === "staff") return "/dashboard/orders";
  return "/dashboard";
}

export function RequireMember({ children }) {
  const { session } = useAuth();
  const location = useLocation();
  if (session === null) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!session.membership) return <Navigate to={session.user.is_platform_admin ? "/admin" : "/login"} replace />;
  return children;
}

export function OwnerOnly({ children }) {
  const { session } = useAuth();
  if (session?.membership?.role !== "owner") return <Navigate to="/dashboard/orders" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { session } = useAuth();
  const location = useLocation();
  if (session === null) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!session.user.is_platform_admin) return <Navigate to={homeFor(session)} replace />;
  return children;
}
