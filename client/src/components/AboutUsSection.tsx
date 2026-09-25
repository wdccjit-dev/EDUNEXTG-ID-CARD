import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Layers,
  Lock,
  Palette,
  Phone,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AboutUsSection() {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[#d6e3dc] bg-gradient-to-br from-[#102728] via-[#143635] to-[#0d2222] p-8 sm:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#40c8bb]/30 bg-[#40c8bb]/10 px-3 py-1 text-xs font-bold text-[#40c8bb]">
            <Sparkles className="h-3.5 w-3.5" />
            Insight Education Platform
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-5xl leading-[1.1]">
            Empowering Schools with Unified, Secure{" "}
            <span className="text-[#40c8bb]">Student Identity.</span>
          </h1>

          <p className="text-sm sm:text-base leading-relaxed text-[#c1d7d2] max-w-2xl">
            Insight Education by EduNextG is the next-generation multi-tenant identity lifecycle platform.
            From drag-and-drop dynamic card templates to cryptographic QR verification and bulk print production,
            we empower schools and educational administrators with effortless identity management.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-[#40c8bb]" />
              <span>Multi-Tenant School Isolation</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <Printer className="h-4 w-4 text-[#f5c87b]" />
              <span>High-Res CR80 PVC Print Engine</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <QrCode className="h-4 w-4 text-[#93c5fd]" />
              <span>Cryptographic QR Verification</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#0f7f79]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-10 bottom-0 h-64 w-64 rounded-full bg-[#f5c87b]/10 blur-2xl" />
      </section>

      {/* Core Mission & Vision */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="rounded-3xl border border-[#dfe7e2] bg-[#fffefa] shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dff3ee] text-[#0f7f79]">
              <GraduationCap className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#182326]">
              Our Mission
            </h2>
            <p className="text-sm leading-relaxed text-[#5e716e]">
              To eliminate manual card production delays, inconsistent school branding, and verification vulnerabilities.
              We provide schools and educational trusts with an automated, tamper-proof ID card ecosystem that guarantees
              fast turnaround, perfect brand fidelity, and uncompromised student safety.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-[#dfe7e2] bg-[#fffefa] shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#c65c3d]">
              <HeartHandshake className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#182326]">
              Partnership & Trust
            </h2>
            <p className="text-sm leading-relaxed text-[#5e716e]">
              Trusted by leading academies, K-12 institutions, and university networks. Insight Education is engineered
              for seamless school onboarding, where administrators generate custom credentials for each school in seconds,
              giving schools autonomous template selection while centralizing approval governance.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Key Architectural Pillars */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#0f7f79]">
              Platform Architecture
            </div>
            <h2 className="text-2xl font-black tracking-tight text-[#182326]">
              Engineered for Scale & Security
            </h2>
          </div>
          <span className="hidden rounded-full border border-[#d6e3dc] bg-[#eef7f3] px-3 py-1 text-xs font-bold text-[#0f7f79] sm:inline-block">
            Production Ready
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#dfe7e2] bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3ee] text-[#0f7f79]">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-[#182326]">Multi-Tenant Isolation</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#778381]">
              Zero cross-school data leakage. Each institution operates in an isolated tenant scope, seeing exclusively its own students and cards.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dfe7e2] bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9ebfa] text-[#5c64b7]">
              <Palette className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-[#182326]">Dynamic Template Studio</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#778381]">
              Live visual canvas editor supporting portrait and landscape orientations, dynamic placeholders, barcodes, and custom brand palettes.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dfe7e2] bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff8d9] text-[#9d7611]">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-[#182326]">Multi-Stage Approvals</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#778381]">
              Formal review lifecycle (Draft → Submitted → Reviewed → Approved → Printed) with real-time school notifications and change request audit logs.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dfe7e2] bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e8] text-[#c65c3d]">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-[#182326]">Bulk Print Generation</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#778381]">
              High-speed PDF vector rendering engine generating single and bulk multi-page print files formatted precisely for standard PVC card printers.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Compliance Highlights */}
      <section className="rounded-3xl border border-[#dce6e1] bg-[#f2f8f5] p-6 sm:p-8">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0f7f79]">
            <Lock className="h-3.5 w-3.5" /> Security & Governance
          </div>
          <h2 className="text-xl font-black text-[#182326]">
            Enterprise-Grade Protection & Cryptography
          </h2>
          <p className="text-xs sm:text-sm text-[#5e716e] leading-relaxed">
            Insight Education enforces state-of-the-art security practices across all layers. All passwords are protected
            using salted Scrypt key derivation. Application sessions utilize secure, signed JSON Web Tokens with HTTP-only
            cookie storage. Every administrative change is logged to an immutable append-only audit trail.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-bold text-[#274844]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0f7f79]" />
              <span>Full Role-Based Access Control (RBAC)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0f7f79]" />
              <span>Tenant-Enforced SQL Queries & API Guards</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0f7f79]" />
              <span>Tamper-Proof QR Code Verification Hashes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0f7f79]" />
              <span>Append-Only Administrative Audit Trails</span>
            </div>
          </div>
        </div>
      </section>

      {/* Company & Support Information Footer Card */}
      <section className="rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#778381]">
              EduNextG
            </div>
            <h3 className="text-lg font-black text-[#182326]">
              Insight Education Management Suite
            </h3>
            <p className="text-xs text-[#778381]">
              Version 2.2.0 (Internal Build) · Developed by Rishu Rajak.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#b7e3d9] bg-[#dff3ee] px-4 py-2.5 text-xs font-extrabold text-[#0b716b]">
              <span className="h-2 w-2 rounded-full bg-[#0b716b] animate-pulse" />
              System Status: Operational
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
