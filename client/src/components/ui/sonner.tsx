import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          success:
            "!bg-[#edfbf4] !text-[#0f6f43] !border-[#a3e4c4] [&_[data-icon]]:!text-[#16a34a] shadow-[0_8px_24px_rgba(22,163,74,0.12)] font-semibold",
          error:
            "!bg-[#fef2f2] !text-[#991b1b] !border-[#fca5a5] [&_[data-icon]]:!text-[#dc2626] shadow-[0_8px_24px_rgba(220,38,38,0.12)] font-semibold",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "#edfbf4",
          "--success-text": "#0f6f43",
          "--success-border": "#a3e4c4",
          "--error-bg": "#fef2f2",
          "--error-text": "#991b1b",
          "--error-border": "#fca5a5",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
