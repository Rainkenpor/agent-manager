import type { CreateHttpEndpointDTO, HttpEndpointEntity, UpdateHttpEndpointDTO } from '../entities/http-endpoint.entity.js'

export interface IHttpEndpointRepository {
	findAll(): Promise<HttpEndpointEntity[]>
	findById(id: string): Promise<HttpEndpointEntity | null>
	findByName(name: string): Promise<HttpEndpointEntity | null>
	findScheduled(): Promise<HttpEndpointEntity[]>
	create(data: CreateHttpEndpointDTO): Promise<HttpEndpointEntity>
	update(id: string, data: UpdateHttpEndpointDTO): Promise<HttpEndpointEntity>
	updateLastRun(id: string, status: number | null, result: string): Promise<void>
	delete(id: string): Promise<void>
}
