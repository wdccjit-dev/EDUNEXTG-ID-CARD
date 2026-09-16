import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import TemplateDesigner from "./pages/TemplateDesigner";
import { ForgotPassword, ResetPassword } from "./pages/PasswordReset";
import { api, type ApiAuthUser } from "./lib/api";

function ProtectedPortal({ portal, initialNav }: { portal: "admin" | "school"; initialNav?: string }) {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.auth.me().then((nextUser) => { if (portal === "admin" && nextUser.role !== "SUPER_ADMIN") { navigate("/school"); return; } if (portal === "school" && nextUser.role === "SUPER_ADMIN") { navigate("/admin"); return; } setUser(nextUser); }).catch(() => navigate(portal === "admin" ? "/admin/login" : "/school/login")).finally(() => setLoading(false)); }, [navigate, portal]);
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-sm text-[#778381]">Loading your workspace…</main>;
  return user ? <Home authenticatedUser={user} portal={portal} initialNav={initialNav} /> : null;
}

function ProtectedDesigner() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.auth.me().then((u) => { if (u.role !== "SUPER_ADMIN") { navigate("/school"); return; } setAuthed(true); }).catch(() => navigate("/admin/login")).finally(() => setLoading(false)); }, [navigate]);
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-sm text-[#778381]">Loading designer…</main>;
  return authed ? <TemplateDesigner /> : null;
}

function Router() {
  return <Switch>
    <Route path="/login"><Login initialRole="school" /></Route>
    <Route path="/admin/login"><Login initialRole="admin" /></Route>
    <Route path="/school/login"><Login initialRole="school" /></Route>
    <Route path="/forgot-password"><ForgotPassword /></Route>
    <Route path="/reset-password"><ResetPassword /></Route>
    <Route path="/admin/templates/:id/design"><ProtectedDesigner /></Route>
    <Route path="/admin"><ProtectedPortal portal="admin" /></Route>
    <Route path="/admin/schools"><ProtectedPortal portal="admin" initialNav="Schools" /></Route>
    <Route path="/admin/users"><ProtectedPortal portal="admin" initialNav="Users" /></Route>
    <Route path="/admin/templates"><ProtectedPortal portal="admin" initialNav="ID card templates" /></Route>
    <Route path="/admin/requests"><ProtectedPortal portal="admin" initialNav="ID card requests" /></Route>
    <Route path="/admin/approved-cards"><ProtectedPortal portal="admin" initialNav="Approved cards" /></Route>
    <Route path="/admin/reports"><ProtectedPortal portal="admin" initialNav="Reports" /></Route>
    <Route path="/admin/notifications"><ProtectedPortal portal="admin" initialNav="Notifications" /></Route>
    <Route path="/admin/audit-logs"><ProtectedPortal portal="admin" initialNav="Audit logs" /></Route>
    <Route path="/school"><ProtectedPortal portal="school" /></Route>
    <Route path="/school/template"><ProtectedPortal portal="school" initialNav="ID card templates" /></Route>
    <Route path="/school/id-cards"><ProtectedPortal portal="school" initialNav="ID card requests" /></Route>
    <Route path="/school/requests"><ProtectedPortal portal="school" initialNav="ID card requests" /></Route>
    <Route path="/school/approved-cards"><ProtectedPortal portal="school" initialNav="Approved cards" /></Route>
    <Route path="/school/notifications"><ProtectedPortal portal="school" initialNav="Notifications" /></Route>
    <Route path="/"><PortalRedirect /></Route>
    <Route><PortalRedirect /></Route>
  </Switch>;
}

function PortalRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { api.auth.me().then((user) => navigate(user.role === "SUPER_ADMIN" ? "/admin" : "/school")).catch(() => navigate("/school/login")); }, [navigate]);
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-sm text-[#778381]">Checking session…</main>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
