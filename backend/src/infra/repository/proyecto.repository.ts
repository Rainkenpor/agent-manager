import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateHistoriaComentarioDTO,
	CreateHistoriaDTO,
	CreateParticipanteDTO,
	CreateProyectoDTO,
	CreateServicioDTO,
	HistoriaComentario,
	HistoriaStatus,
	HistoriaUsuario,
	ProyectoParticipante,
	ProyectoRecord,
	ProyectoServicio,
	RepoFileStatus,
	UpdateHistoriaDTO,
	UpdateProyectoDTO,
	UpdateServicioDTO
} from '../../domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '../../domain/repositories/proyecto.repository.js'
import { AppDataSource } from '../db/database.js'
import {
	HistoriaComentarioEntity,
	HistoriaUsuarioEntity,
	ProyectoEntity,
	ProyectoParticipanteEntity,
	ProyectoServicioEntity
} from '../db/entities.js'

export class ProyectoRepository implements IProyectoRepository {
	private get repo() {
		return AppDataSource.getRepository(ProyectoEntity)
	}
	private get servicioRepo() {
		return AppDataSource.getRepository(ProyectoServicioEntity)
	}
	private get historiaRepo() {
		return AppDataSource.getRepository(HistoriaUsuarioEntity)
	}
	private get comentarioRepo() {
		return AppDataSource.getRepository(HistoriaComentarioEntity)
	}
	private get participanteRepo() {
		return AppDataSource.getRepository(ProyectoParticipanteEntity)
	}

	private normalize(record: ProyectoEntity | null): ProyectoRecord | null {
		if (!record) return null
		return { ...record, stakeholders: record.stakeholders ?? [] } as ProyectoRecord
	}

	private normalizeServicio(record: ProyectoServicioEntity | null): ProyectoServicio | null {
		if (!record) return null
		return {
			...record,
			agentMdStatus: record.agentMdStatus as RepoFileStatus,
			claudeMdStatus: record.claudeMdStatus as RepoFileStatus
		} as ProyectoServicio
	}

	private normalizeHistoria(record: HistoriaUsuarioEntity | null): HistoriaUsuario | null {
		if (!record) return null
		return { ...record, status: record.status as HistoriaStatus } as HistoriaUsuario
	}

	// Proyecto
	async findAll(): Promise<ProyectoRecord[]> {
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map((row) => this.normalize(row) as ProyectoRecord)
	}

	async findById(id: string): Promise<ProyectoRecord | null> {
		return this.normalize(await this.repo.findOneBy({ id }))
	}

	async findByClarifyId(clarifyProjectId: string): Promise<ProyectoRecord | null> {
		return this.normalize(await this.repo.findOneBy({ clarifyProjectId }))
	}

	async create(data: CreateProyectoDTO): Promise<ProyectoRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			description: data.description ?? null,
			clarifyProjectId: data.clarifyProjectId ?? null,
			architecture: data.architecture ?? null,
			programmingLanguage: data.programmingLanguage ?? null,
			stakeholders: data.stakeholders ?? [],
			status: data.status ?? 'active',
			chatAgentId: data.chatAgentId ?? null,
			createdBy: data.createdBy ?? null,
			createdAt: now,
			updatedAt: now
		})
		return this.normalize(await this.repo.save(entity)) as ProyectoRecord
	}

	async update(data: UpdateProyectoDTO): Promise<ProyectoRecord | null> {
		const existing = await this.repo.findOneBy({ id: data.id })
		if (!existing) return null
		const { id, ...changes } = data
		Object.assign(existing, changes, { updatedAt: new Date().toISOString() })
		return this.normalize(await this.repo.save(existing))
	}

	async delete(id: string): Promise<void> {
		await this.comentarioRepo
			.createQueryBuilder()
			.delete()
			.where('historia_id IN (SELECT id FROM historias_usuario WHERE proyecto_id = :id)', { id })
			.execute()
		await this.historiaRepo.delete({ proyectoId: id })
		await this.servicioRepo.delete({ proyectoId: id })
		await this.repo.delete(id)
	}

	// Servicios
	async findServicios(proyectoId: string): Promise<ProyectoServicio[]> {
		const rows = await this.servicioRepo.find({ where: { proyectoId }, order: { name: 'ASC' } })
		return rows.map((row) => this.normalizeServicio(row) as ProyectoServicio)
	}

	async findServicioById(id: string): Promise<ProyectoServicio | null> {
		return this.normalizeServicio(await this.servicioRepo.findOneBy({ id }))
	}

	async createServicio(data: CreateServicioDTO): Promise<ProyectoServicio> {
		const now = new Date().toISOString()
		const entity = this.servicioRepo.create({
			id: uuidv4(),
			proyectoId: data.proyectoId,
			name: data.name,
			repoUrl: data.repoUrl,
			repoRef: data.repoRef ?? null,
			governanceId: data.governanceId ?? null,
			governanceType: data.governanceType ?? null,
			agentMdStatus: 'unknown',
			claudeMdStatus: 'unknown',
			lastCheckedAt: null,
			createdAt: now,
			updatedAt: now
		})
		return this.normalizeServicio(await this.servicioRepo.save(entity)) as ProyectoServicio
	}

	async updateServicio(data: UpdateServicioDTO): Promise<ProyectoServicio | null> {
		const existing = await this.servicioRepo.findOneBy({ id: data.id })
		if (!existing) return null
		const { id, ...changes } = data
		Object.assign(existing, changes, { updatedAt: new Date().toISOString() })
		return this.normalizeServicio(await this.servicioRepo.save(existing))
	}

	async deleteServicio(id: string): Promise<void> {
		await this.servicioRepo.delete(id)
	}

	// Historias de usuario
	async findHistorias(proyectoId: string): Promise<HistoriaUsuario[]> {
		const rows = await this.historiaRepo.find({ where: { proyectoId }, order: { createdAt: 'ASC' } })
		return rows.map((row) => this.normalizeHistoria(row) as HistoriaUsuario)
	}

	async findHistoriaById(id: string): Promise<HistoriaUsuario | null> {
		return this.normalizeHistoria(await this.historiaRepo.findOneBy({ id }))
	}

	async createHistoria(data: CreateHistoriaDTO): Promise<HistoriaUsuario> {
		const now = new Date().toISOString()
		const entity = this.historiaRepo.create({
			id: uuidv4(),
			proyectoId: data.proyectoId,
			code: data.code ?? null,
			title: data.title,
			description: data.description ?? null,
			additionalInfo: data.additionalInfo ?? null,
			status: data.status ?? 'pending',
			createdAt: now,
			updatedAt: now
		})
		return this.normalizeHistoria(await this.historiaRepo.save(entity)) as HistoriaUsuario
	}

	async updateHistoria(data: UpdateHistoriaDTO): Promise<HistoriaUsuario | null> {
		const existing = await this.historiaRepo.findOneBy({ id: data.id })
		if (!existing) return null
		const { id, ...changes } = data
		Object.assign(existing, changes, { updatedAt: new Date().toISOString() })
		return this.normalizeHistoria(await this.historiaRepo.save(existing))
	}

	async deleteHistoria(id: string): Promise<void> {
		await this.comentarioRepo.delete({ historiaId: id })
		await this.historiaRepo.delete(id)
	}

	// Comentarios de HU
	async findComentarios(historiaId: string): Promise<HistoriaComentario[]> {
		return this.comentarioRepo.find({ where: { historiaId }, order: { createdAt: 'ASC' } })
	}

	async createComentario(data: CreateHistoriaComentarioDTO): Promise<HistoriaComentario> {
		const entity = this.comentarioRepo.create({
			id: uuidv4(),
			historiaId: data.historiaId,
			author: data.author,
			content: data.content,
			createdAt: new Date().toISOString()
		})
		return this.comentarioRepo.save(entity)
	}

	// Participantes
	async findParticipantes(proyectoId: string): Promise<ProyectoParticipante[]> {
		return this.participanteRepo.find({ where: { proyectoId }, order: { createdAt: 'ASC' } })
	}

	async findParticipante(proyectoId: string, userId: string): Promise<ProyectoParticipante | null> {
		return this.participanteRepo.findOneBy({ proyectoId, userId })
	}

	async addParticipante(data: CreateParticipanteDTO): Promise<ProyectoParticipante> {
		const entity = this.participanteRepo.create({
			id: uuidv4(),
			proyectoId: data.proyectoId,
			userId: data.userId,
			role: data.role ?? null,
			chatId: null,
			invitedBy: data.invitedBy ?? null,
			createdAt: new Date().toISOString()
		})
		return this.participanteRepo.save(entity)
	}

	async updateParticipante(id: string, changes: { role?: string | null; chatId?: string | null }): Promise<ProyectoParticipante | null> {
		const existing = await this.participanteRepo.findOneBy({ id })
		if (!existing) return null
		Object.assign(existing, changes)
		return this.participanteRepo.save(existing)
	}

	async removeParticipante(proyectoId: string, userId: string): Promise<void> {
		await this.participanteRepo.delete({ proyectoId, userId })
	}

	async findProyectosByParticipant(userId: string): Promise<ProyectoRecord[]> {
		const parts = await this.participanteRepo.find({ where: { userId } })
		const ids = parts.map((p) => p.proyectoId)
		const owned = await this.repo.find({ where: { createdBy: userId } })
		const byPart = ids.length ? await this.repo.find({ where: { id: In(ids) } }) : []
		const map = new Map<string, ProyectoEntity>()
		for (const p of [...owned, ...byPart]) map.set(p.id, p)
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name)).map((row) => this.normalize(row) as ProyectoRecord)
	}
}
