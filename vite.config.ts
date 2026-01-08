import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import prerender from "@prerenderer/rollup-plugin";

// Public marketing routes to pre-render for SEO
const prerenderRoutes = [
  "/",
  "/merchants",
  "/discover",
  "/lost-pets",
  "/install",
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // Optimize chunk splitting for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-popover'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Minify for production
    minify: 'esbuild',
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "robots.txt"],
      manifest: {
        name: "PawBucks - Pet Payment Platform",
        short_name: "PawBucks",
        description: "Digital payment platform for pet services with cashback rewards",
        theme_color: "#3fbcd0",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 3000000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/yxpnkipcoxksmnsvpvwi\.supabase\.co\/.*$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 5 // Reduced from 10 for faster fallback
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    }),
    // Pre-render public marketing routes for SEO (production only)
    mode === "production" && prerender({
      routes: prerenderRoutes,
      renderer: "@prerenderer/renderer-puppeteer",
      rendererOptions: {
        // Wait for network to be idle before capturing
        renderAfterTime: 2000,
        // Inject meta tag to identify pre-rendered pages
        injectProperty: "__PRERENDERED",
        // Wait for document to be fully loaded
        renderAfterDocumentEvent: "DOMContentLoaded",
      },
      postProcess(renderedRoute) {
        // Add prerendered indicator comment
        renderedRoute.html = renderedRoute.html.replace(
          "<head>",
          `<head>\n    <!-- Pre-rendered by PawBucks SEO Engine -->`
        );
        // Remove any scripts that might cause hydration issues
        renderedRoute.html = renderedRoute.html.replace(
          /<script[^>]*>window\.__PRERENDERED[^<]*<\/script>/g,
          ""
        );
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
