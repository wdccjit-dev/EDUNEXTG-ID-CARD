import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoredPreference,
  resolveTheme,
  getSystemTheme,
  type ThemePreference,
} from "@/contexts/ThemeContext";

describe("Theme Preference Logic", () => {
  const originalLocalStorage = global.localStorage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(global, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("retrieves valid stored theme preference (light, dark, system)", () => {
    mockStorage["theme"] = "dark";
    expect(getStoredPreference()).toBe("dark");

    mockStorage["theme"] = "light";
    expect(getStoredPreference()).toBe("light");

    mockStorage["theme"] = "system";
    expect(getStoredPreference()).toBe("system");
  });

  it("falls back to default preference ('light') when storage is empty", () => {
    expect(getStoredPreference()).toBe("light");
    expect(getStoredPreference("dark")).toBe("dark");
  });

  it("falls back to default preference ('light') on invalid stored value", () => {
    mockStorage["theme"] = "invalid-value";
    expect(getStoredPreference()).toBe("light");

    mockStorage["theme"] = "blue";
    expect(getStoredPreference()).toBe("light");

    mockStorage["theme"] = JSON.stringify({ mode: "dark" });
    expect(getStoredPreference()).toBe("light");
  });

  it("handles localStorage exceptions gracefully", () => {
    const errorStorage = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError: localStorage is disabled");
      }),
    };
    Object.defineProperty(global, "localStorage", {
      value: errorStorage,
      writable: true,
      configurable: true,
    });

    expect(getStoredPreference()).toBe("light");
  });

  it("resolves static theme preference directly", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system theme based on matchMedia query", () => {
    // When window.matchMedia indicates dark mode
    const originalWindow = global.window;
    (global as any).window = {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    };

    expect(getSystemTheme()).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");

    // When window.matchMedia indicates light mode
    (global as any).window = {
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    };

    expect(getSystemTheme()).toBe("light");
    expect(resolveTheme("system")).toBe("light");

    // When window or matchMedia is not available (e.g. SSR/node environment)
    (global as any).window = undefined;
    expect(getSystemTheme()).toBe("light");
    expect(resolveTheme("system")).toBe("light");

    global.window = originalWindow;
  });
});
