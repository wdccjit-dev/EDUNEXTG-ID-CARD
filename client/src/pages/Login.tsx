import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showContactAdminModal, setShowContactAdminModal] = useState(false);

  useEffect(() => {
    // If user arrived from logout (sessionStorage flag or just generally on login page),
    // ensure clicking browser back navigates to landing/home page '/' instead of looping or restoring previous page.
    const isLoggedOut = sessionStorage.getItem("just_logged_out");
    if (isLoggedOut) {
      sessionStorage.removeItem("just_logged_out");
      // Push state for login page so back button can be intercepted to go to '/'
      window.history.pushState({ loginPage: true }, "", window.location.pathname);
      const handlePopState = () => {
        window.location.replace("/");
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || password.length < 8) {
      return toast.error("Enter your username or ID and a password of at least 8 characters");
    }

    setBusy(true);
    try {
      const { user } = await api.auth.login(username.trim(), password);

      toast.success("Signed in successfully");
      // Automatically redirect based on user role from backend
      if (user.role === "SUPER_ADMIN") {
        navigate("/admin");
      } else if (user.role === "MARKETING_ADMIN") {
        navigate("/marketing");
      } else {
        navigate("/school");
      }
    } catch (error) {
      await api.auth.logout().catch(() => undefined);
      toast.error("Unable to sign in", {
        description: error instanceof Error ? error.message : "Invalid credentials",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-5">
      <div className="w-full max-w-md">
        {/* Login Form Card */}
        <form
          onSubmit={submit}
          className="rounded-3xl border border-border bg-card p-6 shadow-[0_18px_50px_rgba(38,71,65,0.10)] sm:p-8 text-card-foreground"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card p-1 shadow-sm border border-border">
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="font-extrabold text-foreground">
                  Insight <span className="text-primary">Education</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  ID Card Management Platform
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold tracking-[-0.05em] text-foreground">
            Sign In
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials to access your workspace.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-bold text-foreground">
              Username, Login ID or Email
              <Input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username, Login ID or email"
                className="mt-2 h-11 rounded-xl"
                autoComplete="username"
                required
              />
            </label>

            <div className="block text-xs font-bold text-foreground">
              <label htmlFor="login-password">Password</label>
              <div className="relative mt-2">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1 cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="mt-7 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            {busy ? "Signing in…" : "Sign In"}
          </Button>

          <div className="mt-4 flex items-center justify-center text-xs font-semibold text-primary">
            <button
              type="button"
              onClick={() => setShowContactAdminModal(true)}
              className="hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {/* Contact Administrator Dialog */}
        {showContactAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-card-foreground">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-extrabold text-foreground">Contact Administrator</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Please contact your system <strong>Super Administrator</strong> or school administration to reset or recover your account password and login ID.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowContactAdminModal(false)}
                className="w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
