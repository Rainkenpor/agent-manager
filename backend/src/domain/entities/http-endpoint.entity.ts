import { z } from 'zod'

export const HttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type HttpMethod = (typeof HttpMethods)[number]

export const HttpAuthTypes = ['none', 'bearer', 'api_key'] as const

export type HttpAuthType = (typeof HttpAuthTypes)[number]

export const CreateHttpEndpointSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, hyphens and underscores'),
	description: z.string().optional(),
	url: z.string().url('Debe ser una URL válida'),
	method: z.enum(HttpMethods).optional().default('POST'),
	authType: z.enum(HttpAuthTypes).optional().default('none'),
	authToken: z.string().optional(),
	apiKeyHeader: z.string().optional(),
	apiKeyValue: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
	bodyTemplate: z.string().optional(),
	contentType: z.string().optional(),
	schedule: z.string().optional(),
	active: z.boolean().optional().default(true)
})

export const UpdateHttpEndpointSchema = z.object({
	description: z.string().optional(),
	url: z.string().url('Debe ser una URL válida').optional(),
	method: z.enum(HttpMethods).optional(),
	authType: z.enum(HttpAuthTypes).optional(),
	authToken: z.string().optional(),
	apiKeyHeader: z.string().optional(),
	apiKeyValue: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
	bodyTemplate: z.string().optional(),
	contentType: z.string().optional(),
	schedule: z.string().optional(),
	active: z.boolean().optional()
})

export interface HttpEndpointEntity {
	id: string
	name: string
	description?: string | null
	url: string
	method: HttpMethod
	authType: HttpAuthType
	authToken?: string | null
	apiKeyHeader?: string | null
	apiKeyValue?: string | null
	headers?: Record<string, string> | null
	bodyTemplate?: string | null
	contentType?: string | null
	schedule?: string | null
	active: boolean
	lastRunAt?: string | null
	lastRunStatus?: number | null
	lastRunResult?: string | null
	createdAt: string
	updatedAt: string
}

export interface CreateHttpEndpointDTO {
	name: string
	description?: string
	url: string
	method?: HttpMethod
	authType?: HttpAuthType
	authToken?: string
	apiKeyHeader?: string
	apiKeyValue?: string
	headers?: Record<string, string>
	bodyTemplate?: string
	contentType?: string
	schedule?: string
	active?: boolean
}

export interface UpdateHttpEndpointDTO {
	description?: string
	url?: string
	method?: HttpMethod
	authType?: HttpAuthType
	authToken?: string
	apiKeyHeader?: string
	apiKeyValue?: string
	headers?: Record<string, string>
	bodyTemplate?: string
	contentType?: string
	schedule?: string
	active?: boolean
}
