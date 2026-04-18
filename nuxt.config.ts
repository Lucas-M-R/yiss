export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@vite-pwa/nuxt'
  ],

  runtimeConfig: {
    authEmail: '',
    authPassword: '',
    supabaseServiceKey: '',
    resendApiKey: '',
    emailFrom: 'Spor <onboarding@resend.dev>',
    oauth: {
      google: {
        clientId: '',
        clientSecret: ''
      }
    },
    session: {
      password: ''
    },
    public: {
      supabaseUrl: '',
      appUrl: ''
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Spor - Entraînement en duo',
      short_name: 'Spor',
      description: 'Application de suivi d\'entraînement sportif en duo',
      theme_color: '#18181b',
      background_color: '#18181b',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      categories: ['fitness', 'health'],
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: '/icons/icon-512x512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  },

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  nitro: {
    storage: {
      'magic-links': {
        driver: 'fs',
        base: '.data/magic-links'
      }
    }
  },

  devtools: { enabled: true }
})
