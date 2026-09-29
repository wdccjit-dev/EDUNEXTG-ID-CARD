import { describe, expect, it } from "vitest";
import { bufferFromDataUrl, isSupportedImageBuffer } from "./pdf";

// 1x1 transparent PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("PDF image loading never touches the filesystem", () => {
  it("returns null for file paths instead of reading them", () => {
    expect(bufferFromDataUrl("/etc/passwd")).toBeNull();
    expect(bufferFromDataUrl("../../.env")).toBeNull();
    expect(bufferFromDataUrl("C:\\Windows\\win.ini")).toBeNull();
    expect(bufferFromDataUrl("./package.json")).toBeNull();
    expect(bufferFromDataUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for URLs and empty values", () => {
    expect(bufferFromDataUrl("https://example.com/photo.png")).toBeNull();
    expect(bufferFromDataUrl("")).toBeNull();
    expect(bufferFromDataUrl("   ")).toBeNull();
  });

  it("returns null for non-image base64 payloads (magic-byte check)", () => {
    const text = Buffer.from("this is definitely not an image, just a long enough plain text payload").toString("base64");
    expect(bufferFromDataUrl(text)).toBeNull();
    expect(bufferFromDataUrl(`data:image/png;base64,${text}`)).toBeNull();
  });

  it("returns null for data URLs that are not base64", () => {
    expect(bufferFromDataUrl("data:image/png,not-base64-content-at-all-just-plain-text-here-1234567890")).toBeNull();
  });

  it("accepts a real PNG as a data URL and as raw base64", () => {
    const fromDataUrl = bufferFromDataUrl(`data:image/png;base64,${PNG_BASE64}`);
    const fromRaw = bufferFromDataUrl(PNG_BASE64);
    expect(fromDataUrl).not.toBeNull();
    expect(fromRaw).not.toBeNull();
    expect(isSupportedImageBuffer(fromDataUrl!)).toBe(true);
  });

  it("tolerates whitespace/newlines inside base64", () => {
    const wrapped = PNG_BASE64.replace(/(.{20})/g, "$1\n");
    expect(bufferFromDataUrl(`data:image/png;base64,${wrapped}`)).not.toBeNull();
  });
});
