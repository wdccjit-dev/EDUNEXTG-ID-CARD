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
            Insight Education provides educational institutions with a complete, modern platform for managing student ID cards.
            From customizable design templates to streamlined school approvals and high-quality print generation,
            we help schools maintain professional branding and trusted student identification.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-[#40c8bb]" />
              <span>Dedicated School Portals</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <Printer className="h-4 w-4 text-[#f5c87b]" />
              <span>Print-Ready Card Production</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md">
              <QrCode className="h-4 w-4 text-[#93c5fd]" />
              <span>Instant Verification & QR</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#0f7f79]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-10 bottom-0 h-64 w-64 rounded-full bg-[#f5c87b]/10 blur-2xl" />
      </section>

      {/* Core Mission & Vision */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="rounded-3xl border border-border bg-card shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              Our Mission
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To simplify student identity management for educational institutions of every size.
              We eliminate manual design delays, ensure consistent school branding, and provide an
              effortless verification system that keeps student data organized, accurate, and secure.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border bg-card shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0e8] dark:bg-[#3d1e16] text-[#c65c3d] dark:text-[#f28a63]">
              <HeartHandshake className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              Partnership & Trust
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Built specifically for schools, academies, and educational groups.
              Administrators can easily onboard schools, share curated ID templates, and oversee card
              approvals, giving schools autonomy while maintaining institutional standards.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Key Architectural Pillars */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-primary">
              Platform Capabilities
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Built for Modern Education
            </h2>
          </div>
          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:inline-block">
            Fast & Reliable
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-foreground">Independent School Accounts</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Each school has its own dedicated portal with private access, ensuring student records and card data remain completely separated and confidential.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9ebfa] dark:bg-[#1e223d] text-[#5c64b7] dark:text-[#8a94e8]">
              <Palette className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-foreground">Visual Template Designer</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Easily create and customize school ID cards with portrait and landscape layouts, custom school logos, dynamic student fields, and brand colors.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff8d9] dark:bg-[#3d3314] text-[#9d7611] dark:text-[#f2c94c]">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-foreground">Seamless Review & Approval</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A transparent review workflow where schools review student cards, request corrections with feedback notes, and approve ready-to-print designs.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e8] dark:bg-[#3d1e16] text-[#c65c3d] dark:text-[#f28a63]">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-foreground">Print & Export Ready</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Generate crisp print files for individual cards or entire batches with one click, formatted perfectly for professional card printers.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Compliance Highlights */}
      <section className="rounded-3xl border border-border bg-muted/40 p-6 sm:p-8">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Lock className="h-3.5 w-3.5" /> Security & Trust
          </div>
          <h2 className="text-xl font-black text-foreground">
            Protected, Safe & Reliable
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We prioritize student data privacy and system security at every step. Insight Education combines strict
            access permissions, encrypted credentials, and comprehensive activity tracking to ensure your institution's
            records are always safeguarded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Role-based permissions for administrators and staff</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Secure student data protection across all schools</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Instant QR code verification for card authenticity</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Complete activity logs for review and accountability</span>
            </div>
          </div>
        </div>
      </section>

      {/* Company & Support Information Footer Card */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm text-card-foreground">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              EduNextG
            </div>
            <h3 className="text-lg font-black text-foreground">
              Insight Education Management Suite
            </h3>
            <p className="text-xs text-muted-foreground">
              Version 2.3.0 (Internal Build) · Developed by Rishu Rajak.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-extrabold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              System Status: Operational
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
