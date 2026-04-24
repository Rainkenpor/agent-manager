import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { IMcpServerRepository } from '@domain/repositories/mcp-server.repository.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { IRoleRepository } from '@domain/repositories/role.repository.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'
import type { IPermissionRepository } from '@domain/repositories/permission.repository.js'

export interface ImportResult {
	created: number
	skipped: number
	errors: string[]
}

export interface ImportSummary {
	agents?: ImportResult
	skills?: ImportResult
	mcps?: ImportResult
	traceabilities?: ImportResult
	roles?: ImportResult
	users?: ImportResult
}

export class ImportConfigUseCase {
	constructor(
		private readonly agentRepo: IAgentRepository,
		private readonly skillRepo: ISkillRepository,
		private readonly mcpRepo: IMcpServerRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly roleRepo: IRoleRepository,
		private readonly userRepo: IUserRepository,
		private readonly permissionRepo: IPermissionRepository
	) {}

	async execute(payload: Record<string, unknown>): Promise<{ success: true; data: ImportSummary } | { success: false; error: string }> {
		try {
			const summary: ImportSummary = {}

			// Order matters: roles before users, agents/skills/mcps before role assignments
			if (payload.roles) {
				summary.roles = await this._importRoles(payload.roles as any[])
			}
			if (payload.agents) {
				summary.agents = await this._importAgents(payload.agents as any[])
			}
			if (payload.skills) {
				summary.skills = await this._importSkills(payload.skills as any[])
			}
			if (payload.mcps) {
				summary.mcps = await this._importMcps(payload.mcps as any[])
			}
			if (payload.traceabilities) {
				summary.traceabilities = await this._importTraceabilities(payload.traceabilities as any)
			}
			if (payload.users) {
				summary.users = await this._importUsers(payload.users as any[])
			}

			// Apply role assignments after all entities exist
			if (payload.roles) {
				await this._applyRoleAssignments(payload.roles as any[])
			}

			return { success: true, data: summary }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Import failed' }
		}
	}

	private async _importAgents(agents: any[]): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }
		for (const a of agents) {
			try {
				const existing = await this.agentRepo.findBySlug(a.slug)
				if (existing) { result.skipped++; continue }
				await this.agentRepo.create({
					name: a.name,
					slug: a.slug,
					description: a.description,
					mode: a.mode ?? 'primary',
					model: a.model ?? '',
					temperature: a.temperature ?? '0.7',
					tools: a.tools ?? {},
					content: a.content ?? ''
				})
				result.created++
			} catch (e) {
				result.errors.push(`Agent "${a.slug}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		// Set subagent relationships after all agents are created
		for (const a of agents) {
			if (!a.subagentSlugs?.length) continue
			try {
				const agent = await this.agentRepo.findBySlug(a.slug)
				if (!agent) continue
				const subIds: string[] = []
				for (const slug of a.subagentSlugs) {
					const sub = await this.agentRepo.findBySlug(slug)
					if (sub) subIds.push(sub.id)
				}
				if (subIds.length) await this.agentRepo.setSubagents(agent.id, subIds)
			} catch (_) {}
		}
		return result
	}

	private async _importSkills(skills: any[]): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }
		for (const s of skills) {
			try {
				const existing = await this.skillRepo.findBySlug(s.slug)
				if (existing) { result.skipped++; continue }
				await this.skillRepo.create({
					name: s.name,
					slug: s.slug,
					description: s.description,
					content: s.content ?? ''
				})
				result.created++
			} catch (e) {
				result.errors.push(`Skill "${s.slug}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		return result
	}

	private async _importMcps(mcps: any[]): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }
		for (const m of mcps) {
			try {
				const existing = await this.mcpRepo.findByName(m.name)
				if (existing) { result.skipped++; continue }
				await this.mcpRepo.create({
					name: m.name,
					displayName: m.displayName,
					description: m.description,
					type: m.type ?? 'http',
					url: m.url,
					command: m.command,
					args: m.args,
					headers: m.headers,
					credentialFields: m.credentialFields,
					active: m.active ?? true
				})
				result.created++
			} catch (e) {
				result.errors.push(`MCP "${m.name}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		return result
	}

	private async _importTraceabilities(data: { templates?: any[]; instances?: any[] }): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }

		// Build a map of agent slug → id for stage linking
		const allAgents = await this.agentRepo.findAll()
		const agentIdBySlug = new Map(allAgents.map((a) => [a.slug, a.id]))

		for (const t of data.templates ?? []) {
			try {
				const existingTemplates = await this.traceabilityRepo.findAllTemplates()
				const exists = existingTemplates.some((et) => et.name === t.name)
				if (exists) { result.skipped++; continue }

				const template = await this.traceabilityRepo.createTemplate({
					name: t.name,
					description: t.description ?? undefined
				})

				const stageIdByOrder: Record<number, string> = {}
				const sortedStages = [...(t.stages ?? [])].sort((a: any, b: any) => a.order - b.order)

				for (const st of sortedStages) {
					const predecessors = (st.predecessorOrders ?? [])
						.map((ord: number) => stageIdByOrder[ord])
						.filter(Boolean) as string[]

					const agentId = st.agentSlug ? (agentIdBySlug.get(st.agentSlug) ?? null) : null

					const created = await this.traceabilityRepo.createTemplateStage({
						templateId: template.id,
						name: st.name,
						order: st.order,
						type: st.type ?? 'manual',
						agentId,
						documentSchema: st.documentSchema ?? null,
						predecessors
					})
					stageIdByOrder[st.order] = created.id
				}
				result.created++
			} catch (e) {
				result.errors.push(`Template "${t.name}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}

		for (const tr of data.instances ?? []) {
			try {
				const templates = await this.traceabilityRepo.findAllTemplates()
				const template = templates.find((tpl) => tpl.name === tr.templateName)
				if (!template) {
					result.errors.push(`Traceability "${tr.title}": template "${tr.templateName}" not found`)
					continue
				}
				await this.traceabilityRepo.create({
					title: tr.title,
					description: tr.description ?? undefined,
					templateId: template.id
				})
				result.created++
			} catch (e) {
				result.errors.push(`Traceability "${tr.title}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}

		return result
	}

	private async _importRoles(roles: any[]): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }
		for (const r of roles) {
			try {
				const existing = await this.roleRepo.findByName(r.name)
				if (existing) { result.skipped++; continue }
				await this.roleRepo.create({ name: r.name, description: r.description })
				result.created++
			} catch (e) {
				result.errors.push(`Role "${r.name}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		return result
	}

	private async _applyRoleAssignments(roles: any[]): Promise<void> {
		for (const r of roles) {
			const role = await this.roleRepo.findByName(r.name)
			if (!role) continue

			for (const p of r.permissions ?? []) {
				try {
					const perm = await this.permissionRepo.findByResourceAndAction(p.resource, p.action)
					if (perm) await this.roleRepo.assignPermission(role.id, perm.id)
				} catch (_) {}
			}

			for (const slug of r.agentSlugs ?? []) {
				try {
					const agent = await this.agentRepo.findBySlug(slug)
					if (agent) await this.mcpRepo.assignAgentToRole(role.id, agent.id)
				} catch (_) {}
			}

			for (const slug of r.skillSlugs ?? []) {
				try {
					const skill = await this.skillRepo.findBySlug(slug)
					if (skill) await this.skillRepo.assignToRole(role.id, skill.id)
				} catch (_) {}
			}

			for (const name of r.mcpNames ?? []) {
				try {
					const mcp = await this.mcpRepo.findByName(name)
					if (mcp) await this.mcpRepo.assignToRole(role.id, mcp.id)
				} catch (_) {}
			}
		}
	}

	private async _importUsers(users: any[]): Promise<ImportResult> {
		const result: ImportResult = { created: 0, skipped: 0, errors: [] }
		for (const u of users) {
			try {
				const existing = await this.userRepo.findByUsername(u.username)
				if (existing) { result.skipped++; continue }
				const created = await this.userRepo.create({
					username: u.username,
					email: u.email,
					password: 'ChangeMe123!',
					firstName: u.firstName,
					lastName: u.lastName
				})
				for (const roleName of u.roleNames ?? []) {
					const role = await this.roleRepo.findByName(roleName)
					if (role) await this.userRepo.assignRole(created.id, role.id)
				}
				result.created++
			} catch (e) {
				result.errors.push(`User "${u.username}": ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		return result
	}
}
