import { GraduationCap } from "lucide-react";

type SchoolLoaderProps = {
  label?: string;
};

export default function SchoolLoader({
  label = "Preparing your school workspace…",
}: SchoolLoaderProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-1 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-primary/60 border-t-primary motion-reduce:animate-none" />

          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-[0_10px_30px_rgba(15,127,121,0.16)]">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>

          <span className="absolute right-1 top-5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 ring-4 ring-background" />
        </div>

        <p className="mt-4 text-sm font-semibold text-foreground">
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Insight Education Management Suite
        </p>
      </div>
    </main>
  );
}
