import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Build-time guard: ensures favicon references and theme_color stay in sync
 * between index.html and the PWA manifest declared in vite.config.ts.
 *
 * Fails the build (and warns in dev) when:
 *   - index.html theme_color !== manifest theme_color
 *   - msapplication-TileColor !== theme_color
 *   - Any icon file referenced (favicon.ico, favicon-16x16.png, favicon-32x32.png,
 *     apple-touch-icon.png, icon-192.png, icon-512.png, logo.png) is missing from /public
 *   - manifest icons reference a file that does not exist in /public
 */
export function faviconManifestCheck(
  manifestThemeColor: string,
  manifestIcons: Array<{ src: string }>
): Plugin {
  const run = (root: string, throwOnError: boolean) => {
    const errors: string[] = [];
    const indexPath = path.resolve(root, "index.html");
    const publicDir = path.resolve(root, "public");

    if (!fs.existsSync(indexPath)) {
      errors.push(`index.html not found at ${indexPath}`);
    } else {
      const html = fs.readFileSync(indexPath, "utf8");

      // theme-color meta
      const themeMatch = html.match(
        /<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i
      );
      if (!themeMatch) {
        errors.push(`index.html is missing <meta name="theme-color">`);
      } else if (
        themeMatch[1].toLowerCase() !== manifestThemeColor.toLowerCase()
      ) {
        errors.push(
          `theme_color mismatch: index.html="${themeMatch[1]}" vs vite.config.ts manifest="${manifestThemeColor}"`
        );
      }

      // msapplication-TileColor should also match
      const tileMatch = html.match(
        /<meta\s+name=["']msapplication-TileColor["']\s+content=["']([^"']+)["']/i
      );
      if (
        tileMatch &&
        tileMatch[1].toLowerCase() !== manifestThemeColor.toLowerCase()
      ) {
        errors.push(
          `msapplication-TileColor="${tileMatch[1]}" does not match theme_color="${manifestThemeColor}"`
        );
      }

      // Required favicon files referenced from index.html must exist in /public
      const required = [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ];
      for (const file of required) {
        const re = new RegExp(`/${file.replace(/\./g, "\\.")}(\\?[^"']*)?["']`);
        if (re.test(html)) {
          const filePath = path.join(publicDir, file);
          if (!fs.existsSync(filePath)) {
            errors.push(
              `index.html references /${file} but public/${file} is missing`
            );
          }
        } else {
          errors.push(`index.html is missing reference to /${file}`);
        }
      }
    }

    // Manifest icon files (strip ?v= cache-bust query) must exist in /public
    for (const icon of manifestIcons) {
      const cleanSrc = icon.src.split("?")[0].replace(/^\//, "");
      const filePath = path.join(publicDir, cleanSrc);
      if (!fs.existsSync(filePath)) {
        errors.push(
          `Manifest icon "${icon.src}" missing at public/${cleanSrc}`
        );
      }
    }

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
      console.log(
        `[favicon-manifest-check] ✓ favicon + theme_color in sync (theme=${manifestThemeColor})`
      );
    }
  };

  return {
    name: "favicon-manifest-check",
    apply: () => true,
    configResolved(config) {
      // Warn in dev, fail the build in production
      run(config.root, config.command === "build");
    },
  };
}