import { AppDataSource } from '@infra/db/database.js'
import { HttpEndpointEntity } from '@infra/db/entities.js'
import { IsNull, Not } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateHttpEndpointDTO,
	HttpAuthType,
	HttpEndpointEntity as HttpEndpointDomain,
	HttpMethod,
	UpdateHttpEndpointDTO
} from '../../domain/entities/http-endpoint.entity.js'
import type { IHttpEndpointRepository } from '../../domain/repositories/http-endpoint.repository.js'

export class HttpEndpointRepository implements IHttpEndpointRepository {
	private get repo() {
		return AppDataSource.getRepository(HttpEndpointEntity)
	}

	async findAll(): Promise<HttpEndpointDomain[]> {
		const rows = await this.repo.find()
		return rows.map(this.mapEndpoint)
	}

	async findById(id: string): Promise<HttpEndpointDomain | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.mapEndpoint(row) : null
	}

	async findByName(name: string): Promise<HttpEndpointDomain | null> {
		const row = await this.repo.findOneBy({ name })
		return row ? this.mapEndpoint(row) : null
	}

	async findScheduled(): Promise<HttpEndpointDomain[]> {
		const rows = await this.repo.findBy({ active: true, schedule: Not(IsNull()) })
		return rows.map(this.mapEndpoint).filter((e) => !!e.schedule)
	}

	async create(data: CreateHttpEndpointDTO): Promise<HttpEndpointDomain> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			description: data.description ?? null,
			url: data.url,
			method: data.method ?? 'POST',
			authType: data.authType ?? 'none',
			authToken: data.authToken ?? null,
			apiKeyHeader: data.apiKeyHeader ?? null,
			apiKeyValue: data.apiKeyValue ?? null,
			headers: data.headers ?? null,
			bodyTemplate: data.bodyTemplate ?? null,
			contentType: data.contentType ?? null,
			schedule: data.schedule?.trim() ? data.schedule.trim() : null,
			active: data.active ?? true,
			lastRunAt: null,
			lastRunStatus: null,
			lastRunResult: null,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.mapEndpoint(await this.repo.findOneByOrFail({ id: entity.id }))
	}

	async update(id: string, data: UpdateHttpEndpointDTO): Promise<HttpEndpointDomain> {
		const updateData: Partial<HttpEndpointEntity> = { updatedAt: new Date().toISOString() }
		if (data.description !== undefined) updateData.description = data.description
		if (data.url !== undefined) updateData.url = data.url
		if (data.method !== undefined) updateData.method = data.method
		if (data.authType !== undefined) updateData.authType = data.authType
		if (data.authToken !== undefined) updateData.authToken = data.authToken
		if (data.apiKeyHeader !== undefined) updateData.apiKeyHeader = data.apiKeyHeader
		if (data.apiKeyValue !== undefined) updateData.apiKeyValue = data.apiKeyValue
		if (data.headers !== undefined) updateData.headers = data.headers
		if (data.bodyTemplate !== undefined) updateData.bodyTemplate = data.bodyTemplate
		if (data.contentType !== undefined) updateData.contentType = data.contentType
		if (data.schedule !== undefined) updateData.schedule = data.schedule.trim() ? data.schedule.trim() : null
		if (data.active !== undefined) updateData.active = data.active
		await this.repo.update(id, updateData)
		return this.mapEndpoint(await this.repo.findOneByOrFail({ id }))
	}

	async updateLastRun(id: string, status: number | null, result: string): Promise<void> {
		await this.repo.update(id, {
			lastRunAt: new Date().toISOString(),
			lastRunStatus: status,
			lastRunResult: result
		})
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	private mapEndpoint(e: HttpEndpointEntity): HttpEndpointDomain {
		return {
			id: e.id,
			name: e.name,
			description: e.description,
			url: e.url,
			method: e.method as HttpMethod,
			authType: e.authType as HttpAuthType,
			authToken: e.authToken,
			apiKeyHeader: e.apiKeyHeader,
			apiKeyValue: e.apiKeyValue,
			headers: e.headers,
			bodyTemplate: e.bodyTemplate,
			contentType: e.contentType,
			schedule: e.schedule,
			active: e.active,
			lastRunAt: e.lastRunAt,
			lastRunStatus: e.lastRunStatus,
			lastRunResult: e.lastRunResult,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}
}
