import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { IMcpServerRepository } from '@domain/repositories/mcp-server.repository.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { IRoleRepository } from '@domain/repositories/role.repository.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'
import type { IPermissionRepository } from '@domain/repositories/permission.repository.js'

export type ExportResource = 'agents' | 'skills' | 'mcps' | 'traceabilities' | 'roles' | 'users'

export interface ExportConfigDTO {
	resources: ExportResource[]
}

export class ExportConfigUseCase {
	constructor(
		private readonly agentRepo: IAgentRepository,
		private readonly skillRepo: ISkillRepository,
		private readonly mcpRepo: IMcpServerRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly roleRepo: IRoleRepository,
		private readonly userRepo: IUserRepository,
		private readonly permissionRepo: IPermissionRepository
	) {}

	async execute(dto: ExportConfigDTO): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }> {
		try {
			const result: Record<string, unknown> = {
				__version: 1,
				__exportedAt: new Date().toISOString()
			}

			for (const resource of dto.resources) {
				switch (resource) {
					case 'agents':
						result.agents = await this._exportAgents()
						break
					case 'skills':
						result.skills = await this._exportSkills()
						break
					case 'mcps':
						result.mcps = await this._exportMcps()
						break
					case 'traceabilities':
						result.traceabilities = await this._exportTraceabilities()
						break
					case 'roles':
						result.roles = await this._exportRoles()
						break
					case 'users':
						result.users = await this._exportUsers()
						break
				}
			}

			return { success: true, data: result }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Export failed' }
		}
	}

	private async _exportAgents() {
		const agents = await this.agentRepo.findAll()
		return agents.map((a) => ({
			name: a.name,
			slug: a.slug,
			description: a.description,
			mode: a.mode,
			model: a.model,
			temperature: a.temperature,
			tools: a.tools,
			content: a.content,
			isActive: a.isActive,
			useByChat: a.useByChat,
			subagentSlugs: a.subagents.map((s) => s.slug)
		}))
	}

	private async _exportSkills() {
		const skills = await this.skillRepo.findAll()
		return skills.map((s) => ({
			name: s.name,
			slug: s.slug,
			description: s.description,
			content: s.content,
			isActive: s.isActive
		}))
	}

	private async _exportMcps() {
		const mcps = await this.mcpRepo.findAll()
		return mcps.map((m) => ({
			name: m.name,
			displayName: m.displayName,
			description: m.description,
			type: m.type,
			url: m.url,
			command: m.command,
			args: m.args,
			headers: m.headers,
			credentialFields: m.credentialFields,
			active: m.active
		}))
	}

	private async _exportTraceabilities() {
		const allAgents = await this.agentRepo.findAll()
		const agentSlugById = new Map(allAgents.map((a) => [a.id, a.slug]))

		const templates = await this.traceabilityRepo.findAllTemplates()
		const summaries = await this.traceabilityRepo.findAll()
		const traceabilityInstances = await Promise.all(summaries.map((s) => this.traceabilityRepo.findById(s.id)))

		return {
			templates: templates.map((t) => ({
				name: t.name,
				description: t.description,
				stages: t.stages.map((st) => ({
					name: st.name,
					order: st.order,
					type: st.type,
					agentSlug: st.agentId ? (agentSlugById.get(st.agentId) ?? null) : null,
					documentSchema: st.documentSchema,
					predecessorOrders: st.predecessors?.map((predId: string) => {
						const pred = t.stages.find((s) => s.id === predId)
						return pred?.order ?? null
					}).filter((o: number | null) => o !== null) ?? []
				}))
			})),
			instances: traceabilityInstances
				.filter(Boolean)
				.map((tr) => ({
					title: tr!.title,
					description: tr!.description,
					templateName: tr!.templateName,
					stages: tr!.stages.map((st) => ({
						name: st.name,
						status: st.status,
						tasks: st.tasks.map((task) => ({
							title: task.title,
							description: task.description,
							type: task.type,
							status: task.status
						})),
						links: st.links.map((lnk) => ({
							label: lnk.label,
							url: lnk.url,
							platform: lnk.platform
						})),
						documents: (st.documents ?? []).map((doc) => ({
							name: doc.name,
							content: doc.content
						}))
					}))
				}))
		}
	}

	private async _exportRoles() {
		const roles = await this.roleRepo.findAll()
		return await Promise.all(
			roles.map(async (r) => {
				const permissions = await this.roleRepo.getPermissions(r.id)
				const agents = await this.mcpRepo.getAgentsByRole(r.id)
				const mcps = await this.mcpRepo.getByRole(r.id)
				const skills = await this.skillRepo.getByRole(r.id)
				return {
					name: r.name,
					description: r.description,
					active: r.active,
					permissions: permissions.map((p) => ({ resource: p.resource, action: p.action })),
					agentSlugs: agents.map((a) => a.slug),
					mcpNames: mcps.map((m) => m.name),
					skillSlugs: skills.map((s) => s.slug)
				}
			})
		)
	}

	private async _exportUsers() {
		const users = await this.userRepo.findAll()
		return users.map((u) => ({
			username: u.username,
			email: u.email,
			firstName: (u as any).firstName,
			lastName: (u as any).lastName,
			active: (u as any).active ?? true,
			roleNames: (u as any).roles?.map((r: any) => r.name) ?? []
		}))
	}
}
