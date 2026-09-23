import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

type RoleType = "school" | "admin";

type LoginProps = {
  initialRole?: RoleType;
};

export default function Login({ initialRole = "school" }: LoginProps) {
  const [, navigate] = useLocation();
  const [selectedRole, setSelectedRole] = useState<RoleType>(initialRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialRole) {
      setSelectedRole(initialRole);
    }
  }, [initialRole]);

  const handleRoleChange = (role: RoleType) => {
    setSelectedRole(role);
    navigate(role === "admin" ? "/admin/login" : "/school/login", { replace: true });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || password.length < 8) {
      return toast.error("Enter a username and a password of at least 8 characters");
    }

    setBusy(true);
    try {
      const { user } = await api.auth.login(username.trim(), password);

      if (selectedRole === "admin" && user.role !== "SUPER_ADMIN") {
        throw new Error("This account is not a Super Admin account. Please choose 'School' portal.");
      }
      if (selectedRole === "school" && user.role === "SUPER_ADMIN") {
        throw new Error("This is an Administrator account. Please choose 'Admin' portal.");
      }

      toast.success("Signed in successfully");
      navigate(user.role === "SUPER_ADMIN" ? "/admin" : "/school");
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
        {/* Portal Switcher Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#dfe7e2] bg-[#e4ece8] p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => handleRoleChange("school")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              selectedRole === "school"
                ? "bg-white text-[#0f7f79] shadow-sm"
                : "text-[#5e716e] hover:text-[#182326]"
            }`}
          >
            <Building2 className="h-4 w-4" />
            School Portal
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange("admin")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              selectedRole === "admin"
                ? "bg-white text-[#0f7f79] shadow-sm"
                : "text-[#5e716e] hover:text-[#182326]"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Portal
          </button>
        </div>

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
                  {selectedRole === "admin" ? "Admin Console" : "School Management"}
                </div>
              </div>
            </div>

            <span className="rounded-full bg-[#dff3ee] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0f7f79]">
              {selectedRole}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-[-0.05em] text-[#203734]">
            {selectedRole === "admin" ? "Admin Sign In" : "School Sign In"}
          </h1>
          <p className="mt-1 text-sm text-[#778381]">
            {selectedRole === "admin"
              ? "Sign in with your Super Administrator credentials."
              : "Sign in with your School Admin or Operator credentials."}
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-bold text-[#38514e]">
              Username or Email
              <Input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={selectedRole === "admin" ? "Enter admin username or email" : "Enter school username or email"}
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
            className="mt-7 h-11 w-full rounded-xl bg-[#0f7f79] font-bold text-white hover:bg-[#096c67]"
          >
            {busy ? "Signing in…" : `Sign in to ${selectedRole === "admin" ? "Admin" : "School"}`}
          </Button>

          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#0f7f79]">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="hover:underline"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange(selectedRole === "admin" ? "school" : "admin")}
              className="text-[#778381] hover:text-[#0f7f79]"
            >
              Switch to {selectedRole === "admin" ? "School" : "Admin"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
