import React from "react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Moon, Laptop, Check, Palette } from "lucide-react";

export default function SettingsSection() {
  const { preference, theme, setPreference } = useTheme();

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
    description: string;
    icon: typeof Sun;
    previewBg: string;
    previewInner: string;
    previewBorder: string;
  }> = [
    {
      id: "light",
      label: "Light",
      description: "Clean, crisp appearance for bright environments",
      icon: Sun,
      previewBg: "bg-[#f7f6f2]",
      previewInner: "bg-[#fffefa] border-[#dfe7e2]",
      previewBorder: "border-[#0f7f79]",
    },
    {
      id: "dark",
      label: "Dark",
      description: "Sleek, low-glare appearance comfortable for low light",
      icon: Moon,
      previewBg: "bg-[#102728]",
      previewInner: "bg-[#173534] border-[#294344]",
      previewBorder: "border-[#40c8bb]",
    },
    {
      id: "system",
      label: "System",
      description: "Automatically adjusts according to your system display settings",
      icon: Laptop,
      previewBg: "bg-gradient-to-r from-[#f7f6f2] 50% to-[#102728] 50%",
      previewInner: "bg-gradient-to-r from-[#fffefa] 50% to-[#173534] 50% border-[#dfe7e2] dark:border-[#294344]",
      previewBorder: "border-primary",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Customize your personal preferences and interface appearance.
        </p>
      </div>

      {/* Appearance Settings Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-card-foreground">
                Appearance
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Choose how the application interface is styled on this device.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Interface Theme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {themeOptions.map((opt) => {
                const isSelected = preference === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreference(opt.id)}
                    className={`group relative flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-accent/40 shadow-sm"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    {/* Visual Preview Swatch */}
                    <div className={`w-full h-20 rounded-xl mb-3.5 p-2 overflow-hidden border ${opt.previewBg}`}>
                      <div className={`w-full h-full rounded-lg border shadow-xs p-1.5 flex flex-col justify-between ${opt.previewInner}`}>
                        <div className="flex items-center justify-between">
                          <div className="h-2 w-8 rounded-full bg-primary/40" />
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 w-12 rounded-full bg-foreground/20" />
                          <div className="h-1.5 w-16 rounded-full bg-foreground/15" />
                        </div>
                      </div>
                    </div>

                    {/* Option Label and Icon */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <IconComponent
                          className={`h-4 w-4 ${
                            isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span className="text-sm font-bold text-card-foreground">
                          {opt.label}
                        </span>
                      </div>

                      {/* Selected Checkmark Indicator */}
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Status Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
            <div>
              Active display mode:{" "}
              <span className="font-semibold text-foreground capitalize">
                {theme}
              </span>
              {preference === "system" && (
                <span className="ml-1 text-[11px] text-muted-foreground">
                  (matched from device system preference)
                </span>
              )}
            </div>
            <div className="text-[11px]">
              Theme preference is stored locally on this browser.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
