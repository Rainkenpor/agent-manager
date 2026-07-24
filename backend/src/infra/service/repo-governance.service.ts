import type { ProyectoRecord, ProyectoServicio, RepoFileStatus } from '../../domain/entities/proyecto.entity.js'
import { envs } from '../../envs.js'
import { mcpExternalManager } from './mcp-external.js'

/**
 * Servicio para verificar y escribir los archivos de gobernanza (AGENT.md / CLAUDE.md)
 * en los repos de cada servicio de un proyecto, usando el MCP de git externo
 * (`git_read_file` / `git_write`). El nombre del servidor MCP se toma de
 * `GIT_MCP_SERVER_NAME`. Toda llamada externa pasa por `mcpExternalManager`.
 */

const gitServer = () => envs.GIT_MCP_SERVER_NAME

const FILE_NAMES = ['AGENT.md', 'CLAUDE.md'] as const

/** Bloque MANDATORY de inicialización que debe contener cada archivo. */
function buildInstructionBlock(project: ProyectoRecord, service: ProyectoServicio): string {
	const type = service.governanceType || 'agentManager'
	return `## MANDATORY: Inicialización de sesión

**Al inicio de cada sesión**, antes de responder cualquier solicitud, DEBES invocar la herramienta \`get_governance\` con el tipo \`"${type}"\` para cargar las reglas de gobernanza de este servicio:

\`\`\`
get_governance({ type: "${type}" })
\`\`\`

- Si la llamada **tiene éxito**: aplica todas las reglas activas devueltas durante el resto de la sesión.
- Si la llamada **falla** o no está disponible: notifica al usuario inmediatamente con el mensaje _"No es posible continuar: no se pudo obtener la gobernanza del proyecto. Verifica que el servidor MCP esté disponible."_ y no continúes con ninguna tarea.

## Proyecto: ${project.name}

Este repositorio pertenece al proyecto **${project.name}** (id \`${project.id}\`) gestionado en Agent Manager.

Usa las herramientas MCP de Agent Manager para trabajar con el proyecto:

- \`get_proyecto_info({ proyectoId: "${project.id}" })\` — lee toda la información del proyecto: arquitectura, lenguaje, interesados, servicios e historias de usuario con su estado.
- \`add_hu_comment({ historiaId, content })\` — agrega un comentario a una historia de usuario.
- \`update_hu_status({ historiaId, status })\` — cambia el estado de una historia de usuario (\`pending\` | \`in_progress\` | \`done\` | \`blocked\`).
`
}

export function buildAgentMd(project: ProyectoRecord, service: ProyectoServicio): string {
	return `# AGENT.md\n\n${buildInstructionBlock(project, service)}`
}

export function buildClaudeMd(project: ProyectoRecord, service: ProyectoServicio): string {
	return `# CLAUDE.md\n\nEste archivo guía a Claude Code (claude.ai/code) al trabajar en este repositorio.\n\n${buildInstructionBlock(project, service)}`
}

function expectedContent(fileName: string, project: ProyectoRecord, service: ProyectoServicio): string {
	return fileName === 'AGENT.md' ? buildAgentMd(project, service) : buildClaudeMd(project, service)
}

/** Extrae el contenido textual del archivo desde la respuesta (string cruda) del MCP de git. */
function extractFileContent(raw: string): { found: boolean; content: string } {
	if (raw.startsWith('MCP tool error') || raw.startsWith('External MCP tool not found') || raw.startsWith('No active client')) {
		// El MCP no encontró el archivo o hubo error de herramienta.
		return { found: false, content: '' }
	}
	try {
		const parsed = JSON.parse(raw)
		if (typeof parsed === 'string') return { found: true, content: parsed }
		if (parsed && typeof parsed === 'object') {
			if (parsed.success === false) return { found: false, content: '' }
			const content = parsed.content ?? parsed.data ?? parsed.file ?? parsed.text
			if (typeof content === 'string') return { found: true, content }
		}
	} catch {
		// No es JSON: la respuesta cruda es el contenido del archivo.
	}
	return { found: true, content: raw }
}

async function readRepoFile(service: ProyectoServicio, fileName: string, userId?: string): Promise<{ found: boolean; content: string }> {
	const raw = await mcpExternalManager.callTool(
		`mcp__${gitServer()}__git_read_file`,
		{ repoUrl: service.repoUrl, path: fileName, ...(service.repoRef ? { ref: service.repoRef } : {}) },
		userId
	)
	return extractFileContent(raw)
}

function statusFor(found: boolean, content: string, expected: string): RepoFileStatus {
	if (!found) return 'missing'
	return content.includes(expected) ? 'ok' : 'outdated'
}

export interface RepoFileVerification {
	agentMdStatus: RepoFileStatus
	claudeMdStatus: RepoFileStatus
}

/** Lee AGENT.md y CLAUDE.md del repo y compara contra el contenido esperado. */
export async function verifyServiceFiles(
	project: ProyectoRecord,
	service: ProyectoServicio,
	userId?: string
): Promise<RepoFileVerification> {
	if (!mcpExternalManager.isConnected(gitServer())) {
		throw new Error(`El servidor MCP de git "${gitServer()}" no está conectado. Regístralo y conéctalo en la sección de servidores MCP.`)
	}
	const [agent, claude] = await Promise.all([readRepoFile(service, 'AGENT.md', userId), readRepoFile(service, 'CLAUDE.md', userId)])
	return {
		agentMdStatus: statusFor(agent.found, agent.content, expectedContent('AGENT.md', project, service)),
		claudeMdStatus: statusFor(claude.found, claude.content, expectedContent('CLAUDE.md', project, service))
	}
}

/** Escribe AGENT.md y CLAUDE.md corregidos en el repo del servicio. */
export async function applyServiceFiles(
	project: ProyectoRecord,
	service: ProyectoServicio,
	userId?: string
): Promise<RepoFileVerification> {
	if (!mcpExternalManager.isConnected(gitServer())) {
		throw new Error(`El servidor MCP de git "${gitServer()}" no está conectado. Regístralo y conéctalo en la sección de servidores MCP.`)
	}
	for (const fileName of FILE_NAMES) {
		const raw = await mcpExternalManager.callTool(
			`mcp__${gitServer()}__git_write`,
			{
				repoUrl: service.repoUrl,
				path: fileName,
				content: expectedContent(fileName, project, service),
				message: `chore(gobernanza): actualizar ${fileName} para proyecto ${project.name}`,
				...(service.repoRef ? { branch: service.repoRef } : {})
			},
			userId
		)
		if (raw.startsWith('MCP tool error') || raw.startsWith('External MCP tool not found') || raw.startsWith('No active client')) {
			throw new Error(`No se pudo escribir ${fileName} en ${service.repoUrl}: ${raw}`)
		}
	}
	return { agentMdStatus: 'ok', claudeMdStatus: 'ok' }
}
