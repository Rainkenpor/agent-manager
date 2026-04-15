import { randomUUID } from 'node:crypto'
import { container } from '../../application/container.js'
import { permissions, type NewPermission } from './schema.js'
import { db } from './database.js'
import { and, eq } from 'drizzle-orm'

// Semillas para permisos comunes
async function seedDefaultPermissions() {
	const defaultPermissions: NewPermission[] = [
		// Usuarios
		{
			id: randomUUID(),
			resource: 'users',
			action: 'create',
			description: 'Crear usuarios',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'users',
			action: 'read',
			description: 'Ver usuarios',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'users',
			action: 'update',
			description: 'Actualizar usuarios',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'users',
			action: 'delete',
			description: 'Eliminar usuarios',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'users',
			action: 'assign_role',
			description: 'Asignar roles a usuarios',
			createdAt: new Date().toISOString()
		},

		// Roles
		{
			id: randomUUID(),
			resource: 'roles',
			action: 'create',
			description: 'Crear roles',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'roles',
			action: 'read',
			description: 'Ver roles',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'roles',
			action: 'update',
			description: 'Actualizar roles',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'roles',
			action: 'delete',
			description: 'Eliminar roles',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'roles',
			action: 'assign_permission',
			description: 'Asignar permisos a roles',
			createdAt: new Date().toISOString()
		},

		// Permisos
		{
			id: randomUUID(),
			resource: 'permissions',
			action: 'create',
			description: 'Crear permisos',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'permissions',
			action: 'read',
			description: 'Ver permisos',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'permissions',
			action: 'delete',
			description: 'Eliminar permisos',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'agents',
			action: 'create',
			description: 'Crear agentes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'agents',
			action: 'delete',
			description: 'Eliminar agentes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'agents',
			action: 'update',
			description: 'Actualizar agentes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'agents',
			action: 'read',
			description: 'Ver agentes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'mcp_servers',
			action: 'create',
			description: 'Crear servidores MCP',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'mcp_servers',
			action: 'update',
			description: 'Actualizar servidores MCP',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'mcp_servers',
			action: 'delete',
			description: 'Eliminar servidores MCP',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'mcp_servers',
			action: 'read',
			description: 'Ver servidores MCP',
			createdAt: new Date().toISOString()
		},

		// MCP Credentials
		{
			id: randomUUID(),
			resource: 'mcp_credentials',
			action: 'read',
			description: 'Ver credenciales MCP propias',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'mcp_credentials',
			action: 'write',
			description: 'Crear y eliminar credenciales MCP propias',
			createdAt: new Date().toISOString()
		},

		// Chat
		{
			id: randomUUID(),
			resource: 'chat',
			action: 'create',
			description: 'Crear conversaciones y enviar mensajes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'chat',
			action: 'read',
			description: 'Ver conversaciones y mensajes',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'chat',
			action: 'delete',
			description: 'Eliminar conversaciones',
			createdAt: new Date().toISOString()
		},

		// Skills
		{
			id: randomUUID(),
			resource: 'skills',
			action: 'create',
			description: 'Crear skills',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'skills',
			action: 'read',
			description: 'Ver skills',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'skills',
			action: 'update',
			description: 'Actualizar skills',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'skills',
			action: 'delete',
			description: 'Eliminar skills',
			createdAt: new Date().toISOString()
		},

		// Hook Servers
		{
			id: randomUUID(),
			resource: 'hook_servers',
			action: 'create',
			description: 'Crear servidores de hooks',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'hook_servers',
			action: 'read',
			description: 'Ver servidores de hooks',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'hook_servers',
			action: 'update',
			description: 'Actualizar servidores de hooks y asignaciones',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'hook_servers',
			action: 'delete',
			description: 'Eliminar servidores de hooks',
			createdAt: new Date().toISOString()
		},

		// Traceability
		{
			id: randomUUID(),
			resource: 'traceability',
			action: 'create',
			description: 'Crear trazabilidades y templates',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'traceability',
			action: 'read',
			description: 'Ver trazabilidades y templates',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'traceability',
			action: 'update',
			description: 'Actualizar trazabilidades, etapas, tareas y links',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'traceability',
			action: 'delete',
			description: 'Eliminar trazabilidades y templates',
			createdAt: new Date().toISOString()
		},

		// Event Listeners
		{
			id: randomUUID(),
			resource: 'event_listeners',
			action: 'create',
			description: 'Crear event listeners',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'event_listeners',
			action: 'read',
			description: 'Ver event listeners',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'event_listeners',
			action: 'update',
			description: 'Actualizar y disparar event listeners',
			createdAt: new Date().toISOString()
		},
		{
			id: randomUUID(),
			resource: 'event_listeners',
			action: 'delete',
			description: 'Eliminar event listeners',
			createdAt: new Date().toISOString()
		}
	]

	// Usar upsert para cada permiso
	for (const permission of defaultPermissions) {
		// Verificar si existe
		const existing = await db
			.select()
			.from(permissions)
			.where(and(eq(permissions.resource, permission.resource), eq(permissions.action, permission.action)))

		if (existing.length === 0) {
			// Insertar nuevo permiso
			await db.insert(permissions).values(permission)
		} else {
			// Actualizar descripción si cambió
			await db.update(permissions).set({ description: permission.description }).where(eq(permissions.id, existing[0].id))
		}
	}
	console.log(`✅ Seeded ${defaultPermissions.length} default permissions (upserted)`)
}

async function seed() {
	console.log('🌱 Sembrando datos iniciales...\n')

	try {
		// 1. Crear permisos por defecto
		console.log('📜 Creando permisos...')
		console.log('all', await container.userRepository.findAll())
		await seedDefaultPermissions()
		console.log('✅ Permisos creados\n')

		// 2. Crear roles
		console.log('👥 Creando roles...')
		const allRoles = await container.roleRepository.findAll()
		let adminRole = allRoles.find((r) => r.name === 'admin')
		let editorRole = allRoles.find((r) => r.name === 'editor')
		let viewerRole = allRoles.find((r) => r.name === 'viewer')

		if (!adminRole) {
			adminRole = await container.roleRepository.create({
				name: 'admin',
				description: 'Administrador con todos los permisos'
			})
		}

		if (!editorRole) {
			editorRole = await container.roleRepository.create({
				name: 'editor',
				description: 'Editor que puede crear y modificar documentación'
			})
		}

		if (!viewerRole) {
			viewerRole = await container.roleRepository.create({
				name: 'viewer',
				description: 'Usuario que solo puede ver documentación'
			})
		}
		console.log('✅ Roles verificados/creados\n')

		// 3. Asignar todos los permisos al rol admin
		console.log('🔐 Asignando permisos a roles...')
		const allPermissions = await container.permissionRepository.findAll()

		// Remover permisos de roles existentes
		if (adminRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(adminRole.id, permission.id)
			}
		}
		if (editorRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(editorRole.id, permission.id)
			}
		}
		if (viewerRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(viewerRole.id, permission.id)
			}
		}

		for (const permission of allPermissions) {
			await container.roleRepository.assignPermission(adminRole.id, permission.id)
		}

		// Editor: permisos de lectura y escritura de proyectos y secciones
		const editorPermissions = allPermissions.filter(
			(p) => (p.resource === 'projects' || p.resource === 'sections') && ['create', 'read', 'update'].includes(p.action)
		)
		for (const permission of editorPermissions) {
			await container.roleRepository.assignPermission(editorRole.id, permission.id)
		}

		// Viewer: solo lectura
		const viewerPermissions = allPermissions.filter((p) => p.action === 'read')
		for (const permission of viewerPermissions) {
			await container.roleRepository.assignPermission(viewerRole.id, permission.id)
		}
		console.log('✅ Permisos asignados\n')

		// 4. Crear usuario admin
		console.log('👤 Creando usuario administrador...')
		const existingUsers = await container.userRepository.findAll()
		const existingAdmin = existingUsers.find((u) => u.username === 'admin')

		if (!existingAdmin) {
			const adminUser = await container.createUserUseCase.execute({
				email: 'admin@agent.com',
				username: 'admin',
				password: 'admin123',
				firstName: 'Admin',
				lastName: 'Agent'
			})

			await container.userRepository.assignRole(adminUser.id, adminRole.id)
			console.log('✅ Usuario admin creado')
			console.log('   Email: admin@agent.com')
			console.log('   Password: admin123\n')
		} else {
			console.log('✅ Usuario admin ya existe\n')
		}

		// MCP local
		console.log('🛠️  Verificando MCP local...')
		let localMcp = await container.mcpServerRepository.findByName('local')
		if (!localMcp) {
			localMcp = await container.mcpServerRepository.create({
				name: 'local',
				displayName: 'MCP Local',
				description: 'Servidor MCP local',
				type: 'local',
				active: true
			})
		}

		// Asignar MCP local al rol admin (sin restricción de tools = acceso total)
		if (localMcp && adminRole) {
			await container.mcpServerRepository.assignToRole(adminRole.id, localMcp.id)
			console.log('✅ MCP local asignado al rol admin')
		}

		console.log('✅ Seed completado exitosamente!')
	} catch (error: any) {
		console.error('❌ Error durante el seed:', error.message)
		process.exit(1)
	}
}

seed()
