import { createHash, randomBytes } from 'node:crypto'

/**
 * PKCE (Proof Key for Code Exchange — RFC 7636).
 *
 * - `code_verifier`: random 32 bytes → base64url
 * - `code_challenge`: sha256(verifier) → base64url
 * - `code_challenge_method`: S256
 */
export interface PkcePair {
  codeVerifier: string
  codeChallenge: string
}

export function generatePkce(): PkcePair {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function generateOAuthState(): string {
  return randomBytes(32).toString('hex')
}
