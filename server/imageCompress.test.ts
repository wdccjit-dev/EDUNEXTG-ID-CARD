import { describe, expect, it } from "vitest";
import { computeTargetSize, pickQuality } from "@/lib/imageCompress";

describe("Image Compression Pure Helpers", () => {
  describe("computeTargetSize", () => {
    it("never enlarges smaller images", () => {
      const size = computeTargetSize(200, 150, 640, 320);
      expect(size.width).toBe(200);
      expect(size.height).toBe(150);
    });

    it("downscales images keeping aspect ratio so the long side is at most maxLongSide", () => {
      // Landscape 1280x960 (4:3) -> maxLongSide 640 -> 640x480
      const landscape = computeTargetSize(1280, 960, 640, 320);
      expect(landscape.width).toBe(640);
      expect(landscape.height).toBe(480);

      // Portrait 1000x2000 (1:2) -> maxLongSide 640 -> 320x640
      const portrait = computeTargetSize(1000, 2000, 640, 320);
      expect(portrait.width).toBe(320);
      expect(portrait.height).toBe(640);
    });

    it("respects scaleFactor reduction down to minLongSide", () => {
      // 1200x800 -> targetLong normally 640. With scaleFactor 0.9 -> targetLong 576
      const scaled = computeTargetSize(1200, 800, 640, 320, 0.9);
      expect(scaled.width).toBe(576);
      expect(scaled.height).toBe(384);

      // Severe scaleFactor shouldn't drop below minLongSide (320) if original > 320
      const lowScaled = computeTargetSize(1200, 800, 640, 320, 0.1);
      expect(lowScaled.width).toBe(320);
      expect(lowScaled.height).toBe(213);
    });

    it("handles zero or negative dimensions safely", () => {
      expect(computeTargetSize(0, 0)).toEqual({ width: 0, height: 0 });
      expect(computeTargetSize(-10, 100)).toEqual({ width: 0, height: 0 });
    });
  });

  describe("pickQuality binary search", () => {
    it("returns maxQuality if maxQuality size is already within targetMaxBytes", () => {
      // Simulating a small image where quality 0.92 is only 40 KB
      const evaluator = (q: number) => Math.round(q * 40 * 1024);
      const res = pickQuality(evaluator, 0.5, 0.92, 100 * 1024);
      expect(res.quality).toBe(0.92);
      expect(res.size).toBeLessThanOrEqual(100 * 1024);
    });

    it("returns minQuality if even minQuality is above targetMaxBytes", () => {
      // Simulating an image where quality 0.5 is 150 KB
      const evaluator = (q: number) => Math.round(150 * 1024 + q * 50 * 1024);
      const res = pickQuality(evaluator, 0.5, 0.92, 100 * 1024);
      expect(res.quality).toBe(0.5);
      expect(res.size).toBeGreaterThan(100 * 1024);
    });

    it("picks the highest quality whose size is <= targetMaxBytes (100 KB)", () => {
      // Suppose size(q) = (q * 160) KB
      // At q = 0.5: 80 KB (<= 100 KB)
      // At q = 0.625: 100 KB (<= 100 KB)
      // At q = 0.92: 147.2 KB (> 100 KB)
      const targetMax = 100 * 1024;
      const evaluator = (q: number) => Math.round(q * 160 * 1024);
      const res = pickQuality(evaluator, 0.5, 0.92, targetMax);

      expect(res.size).toBeLessThanOrEqual(targetMax);
      expect(res.quality).toBeGreaterThanOrEqual(0.6);
      expect(res.quality).toBeLessThanOrEqual(0.65);
    });
  });
});
