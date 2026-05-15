export const SITE = {
  name: 'Sociflow',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010',
  description: 'AI-powered social media publishing & automation',
  ogImage: '/og.png',
  twitter: '@sociflow',
} as const
