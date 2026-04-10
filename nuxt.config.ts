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
      supabaseUrl: ''
    }
  },

  pwa: {
    manifest: {
      name: 'Spor',
      short_name: 'Spor',
      theme_color: '#18181b',
      background_color: '#18181b',
      display: 'standalone',
      categories: ['fitness'],
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
        }
      ]
    },
    workbox: {
      navigateFallback: '/'
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

  devtools: { enabled: true }
})
