import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Build-time guard: ensures favicon references and theme_color stay in sync
 * across (1) the source index.html, (2) the PWA manifest declared in
 * vite.config.ts, and (3) every emitted HTML entry point in dist/ — including
 * prerendered routes such as /merchants/index.html, /vet-landing/index.html, etc.
 *
 * Fails the build (and warns in dev) when:
 *   - theme_color mismatches between any HTML file and the manifest
 *   - msapplication-TileColor mismatches theme_color
 *   - Any required favicon/PWA tag is missing from any HTML entry point
 *   - A referenced favicon file is missing from /public
 *   - A manifest icon file is missing from /public
 */

/** Tags that must appear in EVERY HTML entry point. */
const REQUIRED_HTML_TAGS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'rel="icon" /favicon.ico', pattern: /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.ico/i },
  { name: 'rel="icon" 32x32', pattern: /<link[^>]+rel=["']icon["'][^>]+sizes=["']32x32["'][^>]+href=["']\/favicon-32x32\.png/i },
  { name: 'rel="icon" 16x16', pattern: /<link[^>]+rel=["']icon["'][^>]+sizes=["']16x16["'][^>]+href=["']\/favicon-16x16\.png/i },
  { name: 'rel="shortcut icon"', pattern: /<link[^>]+rel=["']shortcut icon["']/i },
  { name: 'rel="apple-touch-icon" 180x180', pattern: /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']\/apple-touch-icon\.png/i },
  { name: 'rel="mask-icon"', pattern: /<link[^>]+rel=["']mask-icon["']/i },
  { name: 'rel="manifest"', pattern: /<link[^>]+rel=["']manifest["']/i },
  { name: 'meta theme-color', pattern: /<meta[^>]+name=["']theme-color["']/i },
  { name: 'meta msapplication-TileColor', pattern: /<meta[^>]+name=["']msapplication-TileColor["']/i },
  { name: 'meta msapplication-TileImage', pattern: /<meta[^>]+name=["']msapplication-TileImage["']/i },
  { name: 'meta apple-mobile-web-app-capable', pattern: /<meta[^>]+name=["']apple-mobile-web-app-capable["']/i },
  { name: 'meta apple-mobile-web-app-title', pattern: /<meta[^>]+name=["']apple-mobile-web-app-title["']/i },
  { name: 'meta apple-mobile-web-app-status-bar-style', pattern: /<meta[^>]+name=["']apple-mobile-web-app-status-bar-style["']/i },
  { name: 'meta mobile-web-app-capable', pattern: /<meta[^>]+name=["']mobile-web-app-capable["']/i },
];

/** Validate a single HTML document. Returns a list of error strings. */
function validateHtml(label: string, html: string, manifestThemeColor: string): string[] {
  const errors: string[] = [];

  for (const { name, pattern } of REQUIRED_HTML_TAGS) {
    if (!pattern.test(html)) {
      errors.push(`${label}: missing ${name}`);
    }
  }

  const themeMatch = html.match(
    /<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i
  );
  if (themeMatch && themeMatch[1].toLowerCase() !== manifestThemeColor.toLowerCase()) {
    errors.push(
      `${label}: theme_color="${themeMatch[1]}" does not match manifest="${manifestThemeColor}"`
    );
  }

  const tileMatch = html.match(
    /<meta\s+name=["']msapplication-TileColor["']\s+content=["']([^"']+)["']/i
  );
  if (tileMatch && tileMatch[1].toLowerCase() !== manifestThemeColor.toLowerCase()) {
    errors.push(
      `${label}: msapplication-TileColor="${tileMatch[1]}" does not match theme_color="${manifestThemeColor}"`
    );
  }

  return errors;
}

/** Recursively walk a directory and collect every *.html file path. */
function findHtmlFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

export function faviconManifestCheck(
  manifestThemeColor: string,
  manifestIcons: Array<{ src: string }>
): Plugin {
  const reportErrors = (errors: string[], throwOnError: boolean, okMessage: string) => {
    if (errors.length) {
      const msg =
        `\n[favicon-manifest-check] ${errors.length} issue(s):\n` +
        errors.map((e) => `  ✗ ${e}`).join("\n") +
        `\n`;
      if (throwOnError) {
        throw new Error(msg);
      } else {
        // eslint-disable-next-line no-console
        console.warn(msg);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`[favicon-manifest-check] ✓ ${okMessage}`);
    }
  };

  const runSourceCheck = (root: string, throwOnError: boolean) => {
    const errors: string[] = [];
    const indexPath = path.resolve(root, "index.html");
    const publicDir = path.resolve(root, "public");

    if (!fs.existsSync(indexPath)) {
      errors.push(`index.html not found at ${indexPath}`);
    } else {
      const html = fs.readFileSync(indexPath, "utf8");
      errors.push(...validateHtml("index.html", html, manifestThemeColor));

      // Required favicon files referenced from index.html must exist in /public
      const required = [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ];
      for (const file of required) {
        const filePath = path.join(publicDir, file);
        if (!fs.existsSync(filePath)) {
          errors.push(`public/${file} is missing (referenced by index.html)`);
        }
      }
    }

    // Manifest icon files (strip ?v= cache-bust query) must exist in /public
    for (const icon of manifestIcons) {
      const cleanSrc = icon.src.split("?")[0].replace(/^\//, "");
      const filePath = path.join(root, "public", cleanSrc);
      if (!fs.existsSync(filePath)) {
        errors.push(
          `Manifest icon "${icon.src}" missing at public/${cleanSrc}`
        );
      }
    }

    reportErrors(
      errors,
      throwOnError,
      `source favicon + theme_color in sync (theme=${manifestThemeColor})`
    );
  };

  const runDistCheck = (root: string) => {
    const distDir = path.resolve(root, "dist");
    if (!fs.existsSync(distDir)) return;

    const htmlFiles = findHtmlFiles(distDir);
    const errors: string[] = [];

    for (const file of htmlFiles) {
      const rel = path.relative(distDir, file);
      const html = fs.readFileSync(file, "utf8");
      errors.push(...validateHtml(`dist/${rel}`, html, manifestThemeColor));
    }

    reportErrors(
      errors,
      true, // always fail the build for dist drift
      `${htmlFiles.length} HTML entry point(s) have consistent favicon + PWA tags`
    );
  };

  return {
    name: "favicon-manifest-check",
    apply: () => true,
    configResolved(config) {
      // Warn in dev, fail the build in production
      runSourceCheck(config.root, config.command === "build");
    },
    closeBundle: {
      // Run AFTER the prerender plugin so we validate every emitted HTML.
      order: "post",
      handler() {
        runDistCheck(process.cwd());
      },
    },
  };
}