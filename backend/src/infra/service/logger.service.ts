import * as winston from 'winston'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// Crear directorio de logs si no existe
export const LOG_PATH = join(process.cwd(), 'logs')
if (!existsSync(LOG_PATH)) {
	mkdirSync(LOG_PATH, { recursive: true })
}

// Formato personalizado para los logs
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.printf(({ level, message, timestamp, ...meta }) => {
		let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
		if (Object.keys(meta).length > 0) {
			log += ` ${JSON.stringify(meta)}`
		}
		return log
	})
)

// Formato con colores para la consola
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: 'HH:mm:ss' }),
	winston.format.printf(({ level, message, timestamp, ...meta }) => {
		let log = `${timestamp} ${level}: ${message}`
		if (Object.keys(meta).length > 0 && meta.stack) {
			log += `\n${meta.stack}`
		}
		return log
	})
)

// Crear el logger
export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: logFormat,
	transports: [
		// Console transport
		new winston.transports.Console({
			format: consoleFormat
		}),
		// File transport para todos los logs
		new winston.transports.File({
			filename: join(LOG_PATH, 'combined.log'),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
			tailable: true
		}),
		// File transport solo para errores
		new winston.transports.File({
			filename: join(LOG_PATH, 'error.log'),
			level: 'error',
			maxsize: 5242880, // 5MB
			maxFiles: 5,
			tailable: true
		}),
		// File transport para requests HTTP
		new winston.transports.File({
			filename: join(LOG_PATH, 'requests.log'),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
			tailable: true
		})
	]
})

// Logger específico para requests HTTP
export const requestLogger = winston.createLogger({
	level: 'info',
	format: logFormat,
	transports: [
		new winston.transports.File({
			filename: join(LOG_PATH, 'requests.log'),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
			tailable: true
		})
	]
})

// Logger específico para las peticiones de OpenAI
export const agentLogger = winston.createLogger({
	level: 'info',
	format: logFormat,
	transports: [
		new winston.transports.File({
			filename: join(LOG_PATH, 'agents.log'),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
			tailable: true
		})
	]
})

export default logger
