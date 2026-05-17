import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { constantTimeEqual, decrypt, encrypt, sha256 } from './crypto'

function makeKey(): string {
  return randomBytes(32).toString('base64')
}

describe('crypto', () => {
  describe('encrypt + decrypt round-trip', () => {
    it('decrypts back to original plaintext', () => {
      const key = makeKey()
      const plaintext = 'super-secret-token-abc-123'
      const encrypted = encrypt(plaintext, key)
      const decrypted = decrypt(encrypted, key)
      expect(decrypted).toBe(plaintext)
    })

    it('round-trips unicode + emoji content', () => {
      const key = makeKey()
      const plaintext = 'xin chào — emoji rocket'
      const encrypted = encrypt(plaintext, key)
      expect(decrypt(encrypted, key)).toBe(plaintext)
    })

    it('round-trips empty string', () => {
      const key = makeKey()
      const encrypted = encrypt('', key)
      expect(decrypt(encrypted, key)).toBe('')
    })
  })

  describe('tamper detection', () => {
    it('throws when ciphertext byte is flipped (auth tag mismatch)', () => {
      const key = makeKey()
      const encrypted = encrypt('hello world', key)
      const buf = Buffer.from(encrypted, 'base64')
      // Flip 1 bit in ciphertext region (after iv(12) + tag(16))
      buf[buf.length - 1] = buf[buf.length - 1]! ^ 0x01
      const tampered = buf.toString('base64')
      expect(() => decrypt(tampered, key)).toThrow()
    })

    it('throws when auth tag is altered', () => {
      const key = makeKey()
      const encrypted = encrypt('hello world', key)
      const buf = Buffer.from(encrypted, 'base64')
      // Flip a byte in tag region (offset 12..28)
      buf[20] = buf[20]! ^ 0xff
      const tampered = buf.toString('base64')
      expect(() => decrypt(tampered, key)).toThrow()
    })

    it('throws when decrypt uses wrong key', () => {
      const keyA = makeKey()
      const keyB = makeKey()
      const encrypted = encrypt('hello world', keyA)
      expect(() => decrypt(encrypted, keyB)).toThrow()
    })
  })

  describe('key length validation', () => {
    it('encrypt throws when key is not 32 bytes', () => {
      const shortKey = randomBytes(16).toString('base64')
      expect(() => encrypt('hi', shortKey)).toThrow(/32 bytes/)
    })

    it('decrypt throws when key is not 32 bytes', () => {
      const validKey = makeKey()
      const encrypted = encrypt('hi', validKey)
      const longKey = randomBytes(64).toString('base64')
      expect(() => decrypt(encrypted, longKey)).toThrow(/32 bytes/)
    })

    it('decrypt throws when payload is shorter than iv+tag', () => {
      const key = makeKey()
      const tooShort = Buffer.alloc(10).toString('base64')
      expect(() => decrypt(tooShort, key)).toThrow(/too short/)
    })
  })

  describe('IV uniqueness', () => {
    it('produces different ciphertext for same plaintext (random IV)', () => {
      const key = makeKey()
      const a = encrypt('same input', key)
      const b = encrypt('same input', key)
      expect(a).not.toBe(b)
    })

    it('both ciphertexts decrypt to same plaintext', () => {
      const key = makeKey()
      const plaintext = 'same input'
      const a = encrypt(plaintext, key)
      const b = encrypt(plaintext, key)
      expect(decrypt(a, key)).toBe(plaintext)
      expect(decrypt(b, key)).toBe(plaintext)
    })
  })

  describe('sha256', () => {
    it('returns hex digest of input', () => {
      expect(sha256('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      )
    })

    it('returns same hash for same input', () => {
      expect(sha256('token-xyz')).toBe(sha256('token-xyz'))
    })

    it('returns different hash for different input', () => {
      expect(sha256('a')).not.toBe(sha256('b'))
    })
  })

  describe('constantTimeEqual', () => {
    it('returns true when strings equal', () => {
      expect(constantTimeEqual('abc', 'abc')).toBe(true)
    })

    it('returns false when strings differ', () => {
      expect(constantTimeEqual('abc', 'abd')).toBe(false)
    })

    it('returns false when lengths differ', () => {
      expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    })
  })
})
