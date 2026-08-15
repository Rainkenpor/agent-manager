import 'reflect-metadata'
import { DataSource, type QueryRunner } from 'typeorm'
import { envs } from '../../envs.js'

/**
 * Migración única: vuelca las historias de usuario, sus comentarios y los servicios de cada
 * proyecto al nuevo documento JSON (`proyectos.data`), y luego elimina las tablas legadas.
 *
 * Debe ejecutarse **antes** de arrancar con el código nuevo (`npm run db:migrate-proyectos`):
 * el DataSource de la aplicación usa `synchronize: true` y borraría las columnas
 * `architecture`, `programming_language` y `clarify_project_id` antes de poder leerlas.
 *
 * Es idempotente: una vez migrado, las tablas ya no existen y el script sale sin tocar nada.
 */

const DEAD_TOOLS = [
	'list_historias_usuario',
	'add_hu_comment',
	'update_hu_status',
	'create_historia_usuario',
	'update_historia_usuario',
	'delete_historia_usuario'
]

const isPostgres = envs.SERVER_DB_DIALECT === 'postgres'

/** Marcador de parámetro según el dialecto: `?` en sqlite, `$n` en postgres. */
const ph = (index: number): string => (isPostgres ? `$${index}` : '?')

function buildDataSource(): DataSource {
	if (isPostgres) {
		return new DataSource({ type: 'postgres', url: envs.SERVER_DB_URL, synchronize: false, logging: false, entities: [] })
	}
	return new DataSource({ type: 'better-sqlite3', database: envs.SERVER_DB_PATH, synchronize: false, logging: false, entities: [] })
}

/** `additional_info` se guarda como JSON en texto; se conserva tal cual si no es un objeto. */
function parseAdditionalInfo(raw: unknown): Record<string, unknown> | null {
	if (typeof raw !== 'string' || raw.trim() === '') return null
	const parsed = JSON.parse(raw)
	return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { valor: parsed }
}

async function ensureDataColumn(qr: QueryRunner): Promise<void> {
	if (await qr.hasColumn('proyectos', 'data')) return
	await qr.query('ALTER TABLE proyectos ADD COLUMN data text')
	console.log('✅ Columna "data" agregada a proyectos')
}

async function cleanDeadTools(qr: QueryRunner): Promise<void> {
	const agents: Array<{ id: string; tools: string | null }> = await qr.query('SELECT id, tools FROM agents')
	let cleaned = 0
	for (const agent of agents) {
		if (!agent.tools) continue
		const tools = JSON.parse(agent.tools) as Record<string, boolean>
		const removed = DEAD_TOOLS.filter((name) => `agent-manager_${name}` in tools)
		if (removed.length === 0) continue
		for (const name of removed) delete tools[`agent-manager_${name}`]
		await qr.query(`UPDATE agents SET tools = ${ph(1)} WHERE id = ${ph(2)}`, [JSON.stringify(tools), agent.id])
		cleaned++
	}

	const placeholders = DEAD_TOOLS.map((_, i) => ph(i + 1)).join(', ')
	await qr.query(`DELETE FROM role_mcp_tools WHERE tool_name IN (${placeholders})`, DEAD_TOOLS)

	if (cleaned > 0) console.log(`✅ Herramientas obsoletas de historias de usuario quitadas de ${cleaned} agente(s)`)
}

export async function migrateProyectoData(dataSource: DataSource): Promise<void> {
	const qr = dataSource.createQueryRunner()
	await qr.connect()

	const hasHistorias = await qr.hasTable('historias_usuario')
	const hasComentarios = await qr.hasTable('hu_comentarios')
	const hasServicios = await qr.hasTable('proyecto_servicios')

	if (!hasHistorias && !hasComentarios && !hasServicios) {
		console.log('ℹ️  No hay tablas legadas de proyectos: nada por migrar')
		await qr.release()
		return
	}

	await ensureDataColumn(qr)

	const presentLegacy: string[] = []
	for (const column of ['architecture', 'programming_language', 'clarify_project_id']) {
		if (await qr.hasColumn('proyectos', column)) presentLegacy.push(column)
	}

	const proyectos: Array<Record<string, unknown>> = await qr.query(
		`SELECT id, data${presentLegacy.length ? `, ${presentLegacy.join(', ')}` : ''} FROM proyectos`
	)

	const historias: Array<Record<string, unknown>> = hasHistorias
		? await qr.query(
				'SELECT id, proyecto_id, code, title, description, additional_info, status, created_at, updated_at FROM historias_usuario ORDER BY created_at'
			)
		: []
	const comentarios: Array<Record<string, unknown>> = hasComentarios
		? await qr.query('SELECT id, historia_id, author, content, created_at FROM hu_comentarios ORDER BY created_at')
		: []
	const servicios: Array<Record<string, unknown>> = hasServicios
		? await qr.query('SELECT id, proyecto_id, name, repo_url, repo_ref, governance_type FROM proyecto_servicios ORDER BY name')
		: []

	const comentariosPorHistoria = new Map<string, Array<Record<string, unknown>>>()
	for (const comentario of comentarios) {
		const key = String(comentario.historia_id)
		const list = comentariosPorHistoria.get(key) ?? []
		list.push({ id: comentario.id, autor: comentario.author, contenido: comentario.content, createdAt: comentario.created_at })
		comentariosPorHistoria.set(key, list)
	}

	let migrados = 0
	for (const proyecto of proyectos) {
		const id = String(proyecto.id)
		if (proyecto.data) continue

		const historiasUsuario = historias
			.filter((historia) => historia.proyecto_id === id)
			.map((historia) => ({
				id: historia.id,
				code: historia.code,
				title: historia.title,
				description: historia.description,
				status: historia.status,
				...(parseAdditionalInfo(historia.additional_info) ?? {}),
				comentarios: comentariosPorHistoria.get(String(historia.id)) ?? [],
				createdAt: historia.created_at,
				updatedAt: historia.updated_at
			}))

		const metadatos: Record<string, unknown> = { migradoEn: new Date().toISOString() }
		if (proyecto.programming_language) metadatos.lenguajeProgramacion = proyecto.programming_language
		if (proyecto.clarify_project_id) metadatos.clarifyProjectId = proyecto.clarify_project_id

		const serviciosDelProyecto = servicios
			.filter((servicio) => servicio.proyecto_id === id)
			.map((servicio) => ({
				name: servicio.name,
				repoUrl: servicio.repo_url,
				repoRef: servicio.repo_ref,
				governanceType: servicio.governance_type
			}))
		if (serviciosDelProyecto.length) metadatos.servicios = serviciosDelProyecto

		const data = {
			historiasUsuario,
			arquitectura: proyecto.architecture ? { descripcion: proyecto.architecture } : {},
			proyectosRelacionados: [],
			metadatos
		}

		await qr.query(`UPDATE proyectos SET data = ${ph(1)} WHERE id = ${ph(2)}`, [JSON.stringify(data), id])
		migrados++
	}

	await cleanDeadTools(qr)

	if (hasComentarios) await qr.dropTable('hu_comentarios', true)
	if (hasHistorias) await qr.dropTable('historias_usuario', true)
	if (hasServicios) await qr.dropTable('proyecto_servicios', true)

	console.log(
		`✅ ${migrados} proyecto(s) migrados al JSON de información (${historias.length} historia(s), ${comentarios.length} comentario(s), ${servicios.length} servicio(s))`
	)
	console.log('✅ Tablas legadas eliminadas: hu_comentarios, historias_usuario, proyecto_servicios')

	await qr.release()
}

async function run(): Promise<void> {
	const dataSource = buildDataSource()
	try {
		await dataSource.initialize()
		await migrateProyectoData(dataSource)
	} catch (error) {
		console.error('❌ Error durante la migración:', error instanceof Error ? error.message : error)
		process.exitCode = 1
	} finally {
		if (dataSource.isInitialized) await dataSource.destroy()
	}
}

run()
