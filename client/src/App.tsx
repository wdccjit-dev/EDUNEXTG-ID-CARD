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
const Landing = lazy(() => import("./pages/Landing"));
const AboutUsPage = lazy(() => import("./pages/AboutUsPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const NoticePage = lazy(() => import("./pages/NoticePage"));
const ContactUsPage = lazy(() => import("./pages/ContactUsPage"));

function getPortalForRole(role: string): "admin" | "school" | "partner" {
  if (role === "SUPER_ADMIN") return "admin";
  if (role === "PARTNER" || role === "PARTNER_ADMIN" || role === "MARKETING_ADMIN") return "partner";
  return "school";
}

function ProtectedPortal({ portal, initialNav }: { portal: "admin" | "school" | "partner" | "marketing"; initialNav?: string }) {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = () => {
      api.auth
        .me()
        .then((nextUser) => {
          if (!isMounted) return;
          const correctPortal = getPortalForRole(nextUser.role);
          const isMatching =
            portal === correctPortal ||
            ((portal === "marketing" || portal === "partner") && correctPortal === "partner");
          if (!isMatching) {
            navigate(correctPortal === "admin" ? "/admin" : correctPortal === "partner" ? "/partner" : "/school");
            return;
          }
          setUser(nextUser);
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          window.location.replace(portal === "partner" || portal === "marketing" ? "/partner/login" : portal === "admin" ? "/admin/login" : "/login");
        });
    };

    checkAuth();

    // Catch Back/Forward cache (bfcache) restore or back/forward navigation
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkAuth();
      }
    };
    const handlePopState = () => {
      checkAuth();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    return () => {
      isMounted = false;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate, portal]);

  if (loading) return <SchoolLoader label="Preparing your workspace…" />;
  return user ? <Home authenticatedUser={user} portal={portal === "marketing" ? "partner" : portal} initialNav={initialNav} /> : null;
}

function ProtectedDesigner() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = () => {
      api.auth
        .me()
        .then((u) => {
          if (!isMounted) return;
          if (u.role !== "SUPER_ADMIN") {
            const correctPortal = getPortalForRole(u.role);
            navigate(correctPortal === "partner" ? "/partner" : "/school");
            return;
          }
          setAuthed(true);
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          window.location.replace("/login");
        });
    };

    checkAuth();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkAuth();
      }
    };
    const handlePopState = () => {
      checkAuth();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    return () => {
      isMounted = false;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
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
      <Route path="/partner/login"><Login /></Route>
      <Route path="/marketing/login"><Login /></Route>
      <Route path="/forgot-password"><ForgotPassword /></Route>
      <Route path="/reset-password"><ResetPassword /></Route>
      <Route path="/admin/templates/:id/design"><ProtectedDesigner /></Route>
      <Route path="/admin"><ProtectedPortal portal="admin" /></Route>
      <Route path="/admin/orders/create"><ProtectedPortal portal="admin" initialNav="Create Order" /></Route>
      <Route path="/admin/orders"><ProtectedPortal portal="admin" initialNav="Order List" /></Route>
      <Route path="/admin/schools"><ProtectedPortal portal="admin" initialNav="Schools" /></Route>
      <Route path="/admin/partners"><ProtectedPortal portal="admin" initialNav="Partners" /></Route>
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
      <Route path="/partner"><ProtectedPortal portal="partner" initialNav="Overview" /></Route>
      <Route path="/partner/schools"><ProtectedPortal portal="partner" initialNav="Schools" /></Route>
      <Route path="/partner/orders/create"><ProtectedPortal portal="partner" initialNav="Create Order" /></Route>
      <Route path="/partner/orders"><ProtectedPortal portal="partner" initialNav="Order List" /></Route>
      <Route path="/partner/notifications"><ProtectedPortal portal="partner" initialNav="Overview" /></Route>
      <Route path="/partner/settings"><ProtectedPortal portal="partner" initialNav="Settings" /></Route>
      <Route path="/marketing"><ProtectedPortal portal="partner" initialNav="Overview" /></Route>
      <Route path="/marketing/schools"><ProtectedPortal portal="partner" initialNav="Schools" /></Route>
      <Route path="/marketing/orders/create"><ProtectedPortal portal="partner" initialNav="Create Order" /></Route>
      <Route path="/marketing/orders"><ProtectedPortal portal="partner" initialNav="Order List" /></Route>
      <Route path="/marketing/notifications"><ProtectedPortal portal="partner" initialNav="Overview" /></Route>
      <Route path="/marketing/settings"><ProtectedPortal portal="partner" initialNav="Settings" /></Route>
      <Route path="/about"><ProtectedPortal portal="school" initialNav="About Us" /></Route>
      <Route path="/about-us"><AboutUsPage /></Route>
      <Route path="/products"><ProductsPage /></Route>
      <Route path="/notice"><NoticePage /></Route>
      <Route path="/contact-us"><ContactUsPage /></Route>
      <Route path="/"><Landing /></Route>
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
        navigate(correctPortal === "admin" ? "/admin" : correctPortal === "partner" ? "/partner" : "/school");
      })
      .catch(() => navigate("/login"));
  }, [navigate]);
  return <SchoolLoader label="Checking your school session…" />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultPreference="light" switchable={true}><TooltipProvider><Toaster /><Suspense fallback={<SchoolLoader />}><Router /></Suspense></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
