import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showContactAdminModal, setShowContactAdminModal] = useState(false);

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
    <main className="flex min-h-screen items-center justify-center bg-[#eef4f1] px-4 py-8 sm:px-5">
      <div className="w-full max-w-md">
        {/* Login Form Card */}
        <form
          onSubmit={submit}
          className="rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-6 shadow-[0_18px_50px_rgba(38,71,65,0.10)] sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm border border-[#dfe7e2]">
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="font-extrabold text-[#182326]">
                  Insight <span className="text-[#0f7f79]">Education</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#82908e]">
                  ID Card Management Platform
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold tracking-[-0.05em] text-[#203734]">
            Sign In
          </h1>
          <p className="mt-1 text-sm text-[#778381]">
            Enter your credentials to access your workspace.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-bold text-[#38514e]">
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

            <label className="block text-xs font-bold text-[#38514e]">
              Password
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 h-11 rounded-xl"
                autoComplete="current-password"
                required
              />
            </label>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="mt-7 h-11 w-full rounded-xl bg-[#0f7f79] font-bold text-white hover:bg-[#096c67] cursor-pointer"
          >
            {busy ? "Signing in…" : "Sign In"}
          </Button>

          <div className="mt-4 flex items-center justify-center text-xs font-semibold text-[#0f7f79]">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-6 shadow-2xl space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e1f3ed] text-[#0f7f79]">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-extrabold text-[#203734]">Contact Administrator</h3>
                <p className="mt-2 text-xs leading-5 text-[#5e716e]">
                  Please contact your system <strong>Super Administrator</strong> or school administration to reset or recover your account password and login ID.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowContactAdminModal(false)}
                className="w-full rounded-xl bg-[#0f7f79] font-bold text-white hover:bg-[#096c67] cursor-pointer"
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
