import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { prerenderRoutes } from "./plugins/vite-prerender-routes";
import { faviconManifestCheck } from "./plugins/vite-favicon-manifest-check";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Single source of truth for PWA theme color and icons
const PWA_THEME_COLOR = "#7DD4D4";
const PWA_ICONS = [
  {
    src: "/icon-192.png?v=2",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icon-512.png?v=2",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icon-512.png?v=2",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/apple-touch-icon.png?v=2",
    sizes: "180x180",
    type: "image/png",
    purpose: "any",
  },
];

const rootReact = path.resolve(__dirname, "node_modules/react");
const rootReactDom = path.resolve(__dirname, "node_modules/react-dom");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Keep a single Vite optimized-dependency cache path. React, React DOM, and
  // React Query must resolve through the same optimized graph; multiple cache
  // directories can load separate React module instances and trigger
  // `dispatcher.useEffect` invalid-hook-call crashes.
  cacheDir: "node_modules/.vite-pawbucks-react-singleton",
  server: {
    host: "::",
    port: 8080,
    headers: {
      // The Lovable preview is a live dev surface; optimized dependency chunks
      // must not be browser-cached across dependency graph changes.
      "Cache-Control": "no-store, max-age=0",
    },
  },
  build: {
    // Optimize chunk splitting for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-tabs', '@radix-ui/react-select', '@radix-ui/react-accordion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
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
    // Keep every React entry point in the same optimized dependency graph.
    // Missing jsx-dev-runtime/react-dom-client dedupe can produce duplicate
    // React internals and the `dispatcher.useEffect` invalid-hook-call crash.
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router-dom', '@tanstack/react-query'],
    force: mode === "development",
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "logo.png", "robots.txt"],
      manifest: {
        name: "PawBucks - Pet Payment Platform",
        short_name: "PawBucks",
        description: "Digital payment platform for pet services with cashback rewards",
        theme_color: PWA_THEME_COLOR,
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: PWA_ICONS,
      },
      workbox: {
        // Exclude html from precache — index.html must always come from
        // the network (NetworkFirst rule below) so the latest JS bundle
        // hashes are served. Precaching HTML is the #1 cause of stale PWAs.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 3000000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Don't precache index.html — we want fresh HTML on every navigation.
        // Precaching it locks users into the build at install time.
        navigateFallback: null,
        // Never intercept auth callbacks or OAuth redirects
        navigateFallbackDenylist: [/^\/auth\/callback/, /^\/~oauth/, /^\/reset-password/],
        runtimeCaching: [
          {
            // Always fetch fresh HTML when online; fall back to cache offline.
            // This is THE fix for "users stuck on old version" — without it,
            // the precached index.html shell pins clients to old JS bundle
            // hashes until the SW completes a full background update cycle
            // (which on iOS PWAs can take days due to tab suspension).
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
            // Only cache Supabase REST/storage — NEVER auth or functions endpoints
            urlPattern: /^https:\/\/yxpnkipcoxksmnsvpvwi\.supabase\.co\/rest\/.*$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    }),
    prerenderRoutes(),
    faviconManifestCheck(PWA_THEME_COLOR, PWA_ICONS),
    mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    // Force every optimized dependency and source module to share the same
    // root React objects. This prevents the duplicate-React invalid hook call
    // where QueryClientProvider reads a different dispatcher than react-dom set.
    dedupe: ["react", "react-dom"],
  },
}));
