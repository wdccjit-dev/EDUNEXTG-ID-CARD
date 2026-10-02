import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import SchoolLoader from "./components/SchoolLoader";
import { ThemeProvider } from "./contexts/ThemeContext";
import { api, type ApiAuthUser } from "./lib/api";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const TemplateDesigner = lazy(() => import("./pages/TemplateDesigner"));
const ForgotPassword = lazy(() =>
  import("./pages/PasswordReset").then((module) => ({ default: module.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import("./pages/PasswordReset").then((module) => ({ default: module.ResetPassword })),
);

function getPortalForRole(role: string): "admin" | "school" | "marketing" {
  if (role === "SUPER_ADMIN") return "admin";
  if (role === "MARKETING_ADMIN") return "marketing";
  return "school";
}

function ProtectedPortal({ portal, initialNav }: { portal: "admin" | "school" | "marketing"; initialNav?: string }) {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.auth
      .me()
      .then((nextUser) => {
        const correctPortal = getPortalForRole(nextUser.role);
        if (portal !== correctPortal) {
          navigate(correctPortal === "admin" ? "/admin" : correctPortal === "marketing" ? "/marketing" : "/school");
          return;
        }
        setUser(nextUser);
      })
      .catch(() => navigate(portal === "marketing" ? "/marketing/login" : "/login"))
      .finally(() => setLoading(false));
  }, [navigate, portal]);
  if (loading) return <SchoolLoader label="Preparing your school workspace…" />;
  return user ? <Home authenticatedUser={user} portal={portal} initialNav={initialNav} /> : null;
}

function ProtectedDesigner() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.auth
      .me()
      .then((u) => {
        if (u.role !== "SUPER_ADMIN") {
          const correctPortal = getPortalForRole(u.role);
          navigate(correctPortal === "marketing" ? "/marketing" : "/school");
          return;
        }
        setAuthed(true);
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);
  if (loading) return <SchoolLoader label="Opening the ID card designer…" />;
  return authed ? <TemplateDesigner /> : null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login"><Login /></Route>
      <Route path="/admin/login"><Login /></Route>
      <Route path="/school/login"><Login /></Route>
      <Route path="/marketing/login"><Login /></Route>
      <Route path="/forgot-password"><ForgotPassword /></Route>
      <Route path="/reset-password"><ResetPassword /></Route>
      <Route path="/admin/templates/:id/design"><ProtectedDesigner /></Route>
      <Route path="/admin"><ProtectedPortal portal="admin" /></Route>
      <Route path="/admin/orders/create"><ProtectedPortal portal="admin" initialNav="Create Order" /></Route>
      <Route path="/admin/orders"><ProtectedPortal portal="admin" initialNav="Order List" /></Route>
      <Route path="/admin/schools"><ProtectedPortal portal="admin" initialNav="Schools" /></Route>
      <Route path="/admin/users"><ProtectedPortal portal="admin" initialNav="Users" /></Route>
      <Route path="/admin/templates"><ProtectedPortal portal="admin" initialNav="ID card templates" /></Route>
      <Route path="/admin/requests"><ProtectedPortal portal="admin" initialNav="ID card requests" /></Route>
      <Route path="/admin/approved-cards"><ProtectedPortal portal="admin" initialNav="Approved cards" /></Route>
      <Route path="/admin/reports"><ProtectedPortal portal="admin" initialNav="Reports" /></Route>
      <Route path="/admin/notifications"><ProtectedPortal portal="admin" initialNav="Overview" /></Route>
      <Route path="/admin/audit-logs"><ProtectedPortal portal="admin" initialNav="Audit logs" /></Route>
      <Route path="/admin/about"><ProtectedPortal portal="admin" initialNav="About Us" /></Route>
      <Route path="/admin/settings"><ProtectedPortal portal="admin" initialNav="Settings" /></Route>
      <Route path="/school"><ProtectedPortal portal="school" /></Route>
      <Route path="/school/orders/create"><ProtectedPortal portal="school" initialNav="Create Order" /></Route>
      <Route path="/school/orders"><ProtectedPortal portal="school" initialNav="Order List" /></Route>
      <Route path="/school/template"><ProtectedPortal portal="school" initialNav="ID card templates" /></Route>
      <Route path="/school/id-cards"><ProtectedPortal portal="school" initialNav="ID card requests" /></Route>
      <Route path="/school/requests"><ProtectedPortal portal="school" initialNav="ID card requests" /></Route>
      <Route path="/school/approved-cards"><ProtectedPortal portal="school" initialNav="Approved cards" /></Route>
      <Route path="/school/notifications"><ProtectedPortal portal="school" initialNav="Overview" /></Route>
      <Route path="/school/about"><ProtectedPortal portal="school" initialNav="About Us" /></Route>
      <Route path="/school/settings"><ProtectedPortal portal="school" initialNav="Settings" /></Route>
      <Route path="/marketing"><ProtectedPortal portal="marketing" initialNav="Overview" /></Route>
      <Route path="/marketing/orders/create"><ProtectedPortal portal="marketing" initialNav="Create Order" /></Route>
      <Route path="/marketing/orders"><ProtectedPortal portal="marketing" initialNav="Order List" /></Route>
      <Route path="/marketing/notifications"><ProtectedPortal portal="marketing" initialNav="Overview" /></Route>
      <Route path="/marketing/settings"><ProtectedPortal portal="marketing" initialNav="Settings" /></Route>
      <Route path="/about"><ProtectedPortal portal="school" initialNav="About Us" /></Route>
      <Route path="/"><PortalRedirect /></Route>
      <Route><PortalRedirect /></Route>
    </Switch>
  );
}

function PortalRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    api.auth
      .me()
      .then((user) => {
        const correctPortal = getPortalForRole(user.role);
        navigate(correctPortal === "admin" ? "/admin" : correctPortal === "marketing" ? "/marketing" : "/school");
      })
      .catch(() => navigate("/login"));
  }, [navigate]);
  return <SchoolLoader label="Checking your school session…" />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultPreference="light" switchable={true}><TooltipProvider><Toaster /><Suspense fallback={<SchoolLoader />}><Router /></Suspense></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
