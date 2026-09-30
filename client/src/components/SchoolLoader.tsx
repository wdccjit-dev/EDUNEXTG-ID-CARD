import { GraduationCap } from "lucide-react";

type SchoolLoaderProps = {
  label?: string;
};

export default function SchoolLoader({
  label = "Preparing your school workspace…",
}: SchoolLoaderProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6 dark:bg-[#102728]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-1 rounded-full border-2 border-[#cce7e2] dark:border-[#294b49]" />
          <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-[#40c8bb] border-t-[#0f7f79] motion-reduce:animate-none" />

          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8e8e4] bg-white text-[#0f7f79] shadow-[0_10px_30px_rgba(15,127,121,0.16)] dark:border-[#31514f] dark:bg-[#173534] dark:text-[#74d8cd]">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>

          <span className="absolute right-1 top-5 h-2.5 w-2.5 animate-pulse rounded-full bg-[#f2c94c] ring-4 ring-[#f7f6f2] dark:ring-[#102728]" />
        </div>

        <p className="mt-4 text-sm font-semibold text-[#304541] dark:text-[#eaf4f0]">
          {label}
        </p>
        <p className="mt-1 text-xs text-[#788784] dark:text-[#a6c0bb]">
          Insight Education Management Suite
        </p>
      </div>
    </main>
  );
}
