import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      className="toaster group"
      toastOptions={{
        classNames: {
          success:
            "!bg-[#edfbf4] !text-[#0f6f43] !border-[#a3e4c4] [&_[data-icon]]:!text-[#16a34a] shadow-[0_8px_24px_rgba(22,163,74,0.12)] font-semibold",
          error:
            "!bg-[#dc2626] !text-white !border-[#991b1b] [&_[data-icon]]:!text-white shadow-[0_8px_24px_rgba(153,27,27,0.28)] font-semibold",
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
          "--error-bg": "#dc2626",
          "--error-text": "#ffffff",
          "--error-border": "#991b1b",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
