// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  // TypeScript configuration
  typescript: {
    typeCheck: true,
  },

  // CSS framework (optional - can add Tailwind, etc.)
  css: [],

  // Modules
  modules: ['@nuxt/image', '@pinia/nuxt'],

  // Runtime config for environment variables
  runtimeConfig: {
    // Private keys (only available on server-side)
    // Public keys (exposed to client-side)
    public: {
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID,
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID,
      cognitoIdentityPoolId: process.env.NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID,
      s3Bucket: process.env.NUXT_PUBLIC_S3_BUCKET,
      cloudfrontUrl: process.env.NUXT_PUBLIC_CLOUDFRONT_URL,
      apiUrl: process.env.NUXT_PUBLIC_API_URL,
    },
  },

  // Image optimization
  image: {
    domains: [
      'wildshoot-photos.s3.amazonaws.com',
      // Add CloudFront domain when configured
    ],
    formats: ['webp', 'avif'],
  },

  // Build configuration
  build: {
    transpile: ['aws-amplify'],
  },

  // Server-side rendering configuration
  ssr: true,

  // Generate configuration for static deployment
  nitro: {
    preset: 'aws-amplify',
    // Can also use 's3' preset for static deployment to S3
  },

  // App configuration
  app: {
    head: {
      title: 'Wild Shoot - Photo Sharing App',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          hid: 'description',
          name: 'description',
          content: 'A DevOps-focused photo-sharing application built on AWS',
        },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },

  // Development server configuration
  devServer: {
    port: 3000,
    host: 'localhost',
  },

  // Experimental features
  experimental: {
    // Enable when needed
  },

  // Vite configuration (Nuxt 3 uses Vite under the hood)
  vite: {
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        './runtimeConfig': './runtimeConfig.browser',
      },
    },
  },
});
