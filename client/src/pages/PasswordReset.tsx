import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function ForgotPassword() {
  const [, navigate] = useLocation();

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Please contact your system administrator to recover or reset your account credentials."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#d6e5de] bg-[#f4f8f6] p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e1f3ed] text-[#0f7f79]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-[#1f3733]">Contact Administrator</h3>
          <p className="mt-2 text-xs leading-5 text-[#5e716e]">
            Self-service password reset is disabled. For security and credential management,
            please reach out directly to your <strong>Super Administrator</strong> to reset your login ID or password.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => navigate("/login")}
          className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold text-white hover:bg-[#096c67] cursor-pointer"
        >
          Return to Login
        </Button>
      </div>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [, navigate] = useLocation();
  const tokenFromUrl = new URLSearchParams(window.location.search).get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim()) return toast.error("Paste your reset token");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirmation) return toast.error("Password confirmation does not match");
    setBusy(true);
    try { await api.auth.resetPassword(token.trim(), password); setDone(true); toast.success("Password changed successfully"); }
    catch (error) { toast.error("Could not reset password", { description: error instanceof Error ? error.message : "Invalid or expired token" }); }
    finally { setBusy(false); }
  }

  return <AuthShell title="Reset password" subtitle={done ? "Your password has been changed." : "Choose a new password for your application account."}>
    {done ? <Button onClick={() => navigate("/login")} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67] cursor-pointer">Return to login</Button> : <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-[#38514e]">Reset token<Input value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 h-11 rounded-xl" /></label><label className="block text-xs font-bold text-[#38514e]">New password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 rounded-xl" autoComplete="new-password" /></label><label className="block text-xs font-bold text-[#38514e]">Confirm password<Input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-11 rounded-xl" autoComplete="new-password" /></label><p className="text-[11px] text-[#82908e]">Use at least 8 characters. Confirmation must match.</p><Button disabled={busy} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67] cursor-pointer">{busy ? "Saving…" : "Change password"}</Button></form>}
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef4f1] px-4 py-6 sm:px-5">
      <section className="w-full max-w-md rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-6 shadow-[0_18px_50px_rgba(38,71,65,0.10)] sm:p-8">
        <div className="mb-8 flex items-center gap-3">
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
              account security
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold tracking-[-0.05em] text-[#203734]">{title}</h1>
        <p className="mt-2 text-sm text-[#778381]">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
