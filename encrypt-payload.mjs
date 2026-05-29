import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import 'dotenv/config'

const secret = process.env.CREDENTIAL_ENCRYPTION_KEY
if (!secret) throw new Error('CREDENTIAL_ENCRYPTION_KEY no está en .env')

const payload = JSON.parse(readFileSync('payload.json', 'utf8'))
const plaintext = JSON.stringify(payload)

const key = createHash('sha256').update(secret).digest()
const iv = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', key, iv)
const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()
const out = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`

writeFileSync('payload.encrypted.txt', out)
console.log('Escrito payload.encrypted.txt')
// console.log(out)
