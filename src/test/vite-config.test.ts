import { describe, it, expect } from "vitest";
import viteConfig from "../../vite.config";

describe("Vite build config", () => {
  const config = typeof viteConfig === "function"
    ? viteConfig({ mode: "production", command: "build" } as any)
    : viteConfig;

  it("should have manual chunks configured", () => {
    const chunks = (config as any).build?.rollupOptions?.output?.manualChunks;
    expect(chunks).toBeDefined();
    expect(chunks["vendor-react"]).toContain("react");
    expect(chunks["vendor-motion"]).toContain("framer-motion");
    expect(chunks["vendor-supabase"]).toContain("@supabase/supabase-js");
    expect(chunks["vendor-stripe"]).toContain("@stripe/stripe-js");
    expect(chunks["vendor-charts"]).toContain("recharts");
  });

  it("should target esnext for smaller bundles", () => {
    expect((config as any).build?.target).toBe("esnext");
  });

  it("should use esbuild minification", () => {
    expect((config as any).build?.minify).toBe("esbuild");
  });

  it("should have optimizeDeps includes for pre-bundling", () => {
    const includes = (config as any).optimizeDeps?.include;
    expect(includes).toContain("react");
    expect(includes).toContain("react-dom");
  });
});
