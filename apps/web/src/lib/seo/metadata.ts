import type { Metadata } from 'next'
import { SITE } from './site'

interface CreateMetadataOptions {
  title?: string
  description?: string
  path?: string
  image?: string
  noIndex?: boolean
}

export function createMetadata(opts: CreateMetadataOptions = {}): Metadata {
  const title = opts.title ? `${opts.title} | ${SITE.name}` : SITE.name
  const description = opts.description ?? SITE.description
  const url = opts.path ? `${SITE.url}${opts.path}` : SITE.url
  const image = opts.image ?? SITE.ogImage

  return {
    title,
    description,
    metadataBase: new URL(SITE.url),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: [{ url: image }],
      siteName: SITE.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: SITE.twitter,
    },
    robots: opts.noIndex ? { index: false, follow: false } : undefined,
  }
}
