import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { prerenderRoutes } from "./plugins/vite-prerender-routes";

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
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react-router-dom', '@tanstack/react-query'],
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
        theme_color: "#7DD4D4",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png?v=2",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/apple-touch-icon.png?v=2",
            sizes: "180x180",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 3000000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Never intercept auth callbacks or OAuth redirects
        navigateFallbackDenylist: [/^\/auth\/callback/, /^\/~oauth/, /^\/reset-password/],
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances causing "Invalid hook call" errors
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
