import type { DelegatableAgent, DelegatableAgentTool } from '@domain/entities/agent.entity.js'
import { envs } from '../../envs.js'
import { container } from '../container.js'
import { listAvailableAgentTools } from './agent-tools.service.js'

/**
 * Agentes que el usuario puede usar en el chat: los asignados a sus roles, activos y marcados
 * como useByChat. Sin roles asignados se devuelven todos los activos de chat.
 * El agente enrutador queda siempre fuera — es quien delega, no un destino de delegación.
 */
export async function listChatAgentsForUser(userId: string): Promise<DelegatableAgent[]> {
	const catalog = await listAvailableAgentTools()
	const describeTools = (tools: Record<string, boolean>): DelegatableAgentTool[] =>
		Object.entries(tools)
			.filter(([, enabled]) => enabled)
			.map(([name]) => ({ name, description: catalog.find((t) => t.name === name)?.description ?? '' }))

	const toDelegatable = (agent: {
		id: string
		name: string
		slug: string
		description: string | null
		tools: Record<string, boolean>
	}): DelegatableAgent => ({
		id: agent.id,
		name: agent.name,
		slug: agent.slug,
		description: agent.description ?? null,
		tools: describeTools(agent.tools)
	})

	const userRoles = await container.userRepository.getRoles(userId)

	// Sin roles no hay asignación explícita: se ofrecen los agentes marcados para chat.
	if (userRoles.length === 0) {
		const all = await container.listAgentsUseCase.execute()
		if (!all.success) return []
		return (all.data ?? []).filter((a) => a.isActive && a.useByChat && a.slug !== envs.ROUTER_AGENT_SLUG).map(toDelegatable)
	}

	// Con roles, la asignación agente↔rol es la autorización: basta con que el agente esté activo.
	const seen = new Set<string>()
	const agents: DelegatableAgent[] = []
	for (const role of userRoles) {
		for (const roleAgent of await container.mcpServerRepository.getAgentsByRole(role.id)) {
			if (seen.has(roleAgent.id)) continue
			seen.add(roleAgent.id)

			const full = await container.getAgentUseCase.execute(roleAgent.id)
			if (!full.success || !full.data.isActive || full.data.slug === envs.ROUTER_AGENT_SLUG) continue

			agents.push(toDelegatable(full.data))
		}
	}
	return agents
}
