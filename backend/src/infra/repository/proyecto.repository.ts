import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import {
	type CreateParticipanteDTO,
	type CreateProyectoDTO,
	emptyProyectoData,
	type ProyectoData,
	type ProyectoParticipante,
	type ProyectoRecord,
	type UpdateProyectoDTO
} from '../../domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '../../domain/repositories/proyecto.repository.js'
import { AppDataSource } from '../db/database.js'
import { ProyectoEntity, ProyectoParticipanteEntity } from '../db/entities.js'

export class ProyectoRepository implements IProyectoRepository {
	private get repo() {
		return AppDataSource.getRepository(ProyectoEntity)
	}
	private get participanteRepo() {
		return AppDataSource.getRepository(ProyectoParticipanteEntity)
	}

	private normalize(record: ProyectoEntity | null): ProyectoRecord | null {
		if (!record) return null
		return {
			...record,
			stakeholders: record.stakeholders ?? [],
			data: { ...emptyProyectoData(), ...(record.data ?? {}) }
		} as ProyectoRecord
	}

	// Proyecto
	async findAll(): Promise<ProyectoRecord[]> {
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map((row) => this.normalize(row) as ProyectoRecord)
	}

	async findById(id: string): Promise<ProyectoRecord | null> {
		return this.normalize(await this.repo.findOneBy({ id }))
	}

	async create(data: CreateProyectoDTO): Promise<ProyectoRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			description: data.description ?? null,
			data: data.data ?? emptyProyectoData(),
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

	async updateData(id: string, data: ProyectoData): Promise<ProyectoRecord | null> {
		const existing = await this.repo.findOneBy({ id })
		if (!existing) return null
		existing.data = data
		existing.updatedAt = new Date().toISOString()
		return this.normalize(await this.repo.save(existing))
	}

	async delete(id: string): Promise<void> {
		await this.participanteRepo.delete({ proyectoId: id })
		await this.repo.delete(id)
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
