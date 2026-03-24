import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

/** Derives a 32-byte key from any-length string via SHA-256 */
function deriveKey(secret: string): Buffer {
	return createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a plaintext string.
 * Output format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encrypt(plaintext: string, secret: string): string {
	const key = deriveKey(secret)
	const iv = randomBytes(IV_BYTES)
	const cipher = createCipheriv(ALGORITHM, key, iv)
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
	const tag = cipher.getAuthTag()
	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a ciphertext string produced by `encrypt`.
 * Returns the original plaintext.
 */
export function decrypt(ciphertext: string, secret: string): string {
	const parts = ciphertext.split(':')
	if (parts.length !== 3) throw new Error('Invalid encrypted value format')
	const [ivHex, tagHex, dataHex] = parts
	const key = deriveKey(secret)
	const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
	decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
	const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
	return decrypted.toString('utf8')
}
