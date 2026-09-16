import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return toast.error("Enter your account email");
    setBusy(true);
    try {
      const result = await api.auth.forgotPassword(email.trim());
      setSent(true);
      if (result.developmentResetToken) setDevToken(result.developmentResetToken);
      toast.success("If that email exists, reset instructions are ready");
    } catch (error) {
      toast.error("Could not request a password reset", { description: error instanceof Error ? error.message : "Request failed" });
    } finally { setBusy(false); }
  }

  return <AuthShell title="Forgot password" subtitle={sent ? "Check your email for reset instructions." : "Enter your account email to request a reset."}>
    {!sent ? <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-[#38514e]">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 rounded-xl" autoComplete="email" /></label><Button disabled={busy} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67]">{busy ? "Sending…" : "Request reset"}</Button></form> : <div className="space-y-4"><p className="rounded-xl bg-[#e1f3ed] p-3 text-xs text-[#0a716b]">If an account exists for <strong>{email}</strong>, a reset link has been sent. This message is intentionally the same for known and unknown emails.</p>{devToken && <p className="rounded-xl bg-[#fff8d9] p-3 text-xs text-[#735b10]">Development reset token: <code className="break-all">{devToken}</code></p>}<Button onClick={() => navigate(`/reset-password${devToken ? `?token=${encodeURIComponent(devToken)}` : ""}`)} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67]">Continue to reset password</Button></div>}
    <button type="button" onClick={() => navigate("/school/login")} className="mt-4 w-full text-center text-xs font-semibold text-[#0f7f79] hover:underline">Return to login</button>
  </AuthShell>;
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
    {done ? <Button onClick={() => navigate("/school/login")} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67]">Return to login</Button> : <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-[#38514e]">Reset token<Input value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 h-11 rounded-xl" /></label><label className="block text-xs font-bold text-[#38514e]">New password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 rounded-xl" autoComplete="new-password" /></label><label className="block text-xs font-bold text-[#38514e]">Confirm password<Input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-11 rounded-xl" autoComplete="new-password" /></label><p className="text-[11px] text-[#82908e]">Use at least 8 characters. Confirmation must match.</p><Button disabled={busy} className="h-11 w-full rounded-xl bg-[#0f7f79] font-bold hover:bg-[#096c67]">{busy ? "Saving…" : "Change password"}</Button></form>}
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#eef4f1] px-4 py-6 sm:px-5"><section className="w-full max-w-md rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-6 shadow-[0_18px_50px_rgba(38,71,65,0.10)] sm:p-8"><div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#40c8bb] text-[#092a2b]"><ShieldCheck className="h-6 w-6" /></div><div><div className="font-extrabold text-[#182326]">atlas<span className="text-[#0f7f79]">id</span></div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#82908e]">account security</div></div></div><h1 className="text-2xl font-extrabold tracking-[-0.05em] text-[#203734]">{title}</h1><p className="mt-2 text-sm text-[#778381]">{subtitle}</p><div className="mt-7">{children}</div></section></main>;
}
