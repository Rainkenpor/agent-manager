import { randomUUID } from 'node:crypto'
import { AppDataSource } from './database.js'
import { PermissionEntity } from './entities.js'
import { container } from '../../application/container.js'

async function seedDefaultPermissions() {
	await AppDataSource.initialize()

	const permRepo = AppDataSource.getRepository(PermissionEntity)

	const defaultPermissions = [
		// Usuarios
		{ resource: 'users', action: 'create', description: 'Crear usuarios' },
		{ resource: 'users', action: 'read', description: 'Ver usuarios' },
		{ resource: 'users', action: 'update', description: 'Actualizar usuarios' },
		{ resource: 'users', action: 'delete', description: 'Eliminar usuarios' },
		{ resource: 'users', action: 'assign_role', description: 'Asignar roles a usuarios' },
		// Roles
		{ resource: 'roles', action: 'create', description: 'Crear roles' },
		{ resource: 'roles', action: 'read', description: 'Ver roles' },
		{ resource: 'roles', action: 'update', description: 'Actualizar roles' },
		{ resource: 'roles', action: 'delete', description: 'Eliminar roles' },
		{ resource: 'roles', action: 'assign_permission', description: 'Asignar permisos a roles' },
		// Permisos
		{ resource: 'permissions', action: 'create', description: 'Crear permisos' },
		{ resource: 'permissions', action: 'read', description: 'Ver permisos' },
		{ resource: 'permissions', action: 'delete', description: 'Eliminar permisos' },
		// Agentes
		{ resource: 'agents', action: 'create', description: 'Crear agentes' },
		{ resource: 'agents', action: 'delete', description: 'Eliminar agentes' },
		{ resource: 'agents', action: 'update', description: 'Actualizar agentes' },
		{ resource: 'agents', action: 'read', description: 'Ver agentes' },
		// MCP Servers
		{ resource: 'mcp_servers', action: 'create', description: 'Crear servidores MCP' },
		{ resource: 'mcp_servers', action: 'update', description: 'Actualizar servidores MCP' },
		{ resource: 'mcp_servers', action: 'delete', description: 'Eliminar servidores MCP' },
		{ resource: 'mcp_servers', action: 'read', description: 'Ver servidores MCP' },
		// MCP Credentials
		{ resource: 'mcp_credentials', action: 'read', description: 'Ver credenciales MCP propias' },
		{ resource: 'mcp_credentials', action: 'write', description: 'Crear y eliminar credenciales MCP propias' },
		// Chat
		{ resource: 'chat', action: 'create', description: 'Crear conversaciones y enviar mensajes' },
		{ resource: 'chat', action: 'read', description: 'Ver conversaciones y mensajes' },
		{ resource: 'chat', action: 'delete', description: 'Eliminar conversaciones' },
		// Skills
		{ resource: 'skills', action: 'create', description: 'Crear skills' },
		{ resource: 'skills', action: 'read', description: 'Ver skills' },
		{ resource: 'skills', action: 'update', description: 'Actualizar skills' },
		{ resource: 'skills', action: 'delete', description: 'Eliminar skills' },
		// Hook Servers
		{ resource: 'hook_servers', action: 'create', description: 'Crear servidores de hooks' },
		{ resource: 'hook_servers', action: 'read', description: 'Ver servidores de hooks' },
		{ resource: 'hook_servers', action: 'update', description: 'Actualizar servidores de hooks y asignaciones' },
		{ resource: 'hook_servers', action: 'delete', description: 'Eliminar servidores de hooks' },
		// Traceability
		{ resource: 'traceability', action: 'create', description: 'Crear trazabilidades y templates' },
		{ resource: 'traceability', action: 'read', description: 'Ver trazabilidades y templates' },
		{ resource: 'traceability', action: 'update', description: 'Actualizar trazabilidades, etapas, tareas y links' },
		{ resource: 'traceability', action: 'delete', description: 'Eliminar trazabilidades y templates' },
		// Event Listeners
		{ resource: 'event_listeners', action: 'create', description: 'Crear event listeners' },
		{ resource: 'event_listeners', action: 'read', description: 'Ver event listeners' },
		{ resource: 'event_listeners', action: 'update', description: 'Actualizar y disparar event listeners' },
		{ resource: 'event_listeners', action: 'delete', description: 'Eliminar event listeners' }
	]

	for (const perm of defaultPermissions) {
		const existing = await permRepo.findOneBy({ resource: perm.resource, action: perm.action })
		if (!existing) {
			await permRepo.save(permRepo.create({ id: randomUUID(), ...perm, createdAt: new Date().toISOString() }))
		} else {
			await permRepo.update(existing.id, { description: perm.description })
		}
	}

	console.log(`✅ Seeded ${defaultPermissions.length} default permissions (upserted)`)
}

async function seed() {
	console.log('🌱 Sembrando datos iniciales...\n')

	try {
		console.log('📜 Creando permisos...')
		await seedDefaultPermissions()
		console.log('✅ Permisos creados\n')

		console.log('👥 Creando roles...')
		const allRoles = await container.roleRepository.findAll()
		let adminRole = allRoles.find((r) => r.name === 'admin')
		let editorRole = allRoles.find((r) => r.name === 'editor')
		let viewerRole = allRoles.find((r) => r.name === 'viewer')

		if (!adminRole) adminRole = await container.roleRepository.create({ name: 'admin', description: 'Administrador con todos los permisos' })
		if (!editorRole) editorRole = await container.roleRepository.create({ name: 'editor', description: 'Editor que puede crear y modificar documentación' })
		if (!viewerRole) viewerRole = await container.roleRepository.create({ name: 'viewer', description: 'Usuario que solo puede ver documentación' })
		console.log('✅ Roles verificados/creados\n')

		console.log('🔐 Asignando permisos a roles...')
		const allPermissions = await container.permissionRepository.findAll()

		for (const permission of allPermissions) {
			await container.roleRepository.removePermission(adminRole!.id, permission.id).catch(() => {})
			await container.roleRepository.removePermission(editorRole!.id, permission.id).catch(() => {})
			await container.roleRepository.removePermission(viewerRole!.id, permission.id).catch(() => {})
		}

		for (const permission of allPermissions) {
			await container.roleRepository.assignPermission(adminRole!.id, permission.id)
		}

		const editorPermissions = allPermissions.filter(
			(p) => (p.resource === 'projects' || p.resource === 'sections') && ['create', 'read', 'update'].includes(p.action)
		)
		for (const permission of editorPermissions) {
			await container.roleRepository.assignPermission(editorRole!.id, permission.id)
		}

		const viewerPermissions = allPermissions.filter((p) => p.action === 'read')
		for (const permission of viewerPermissions) {
			await container.roleRepository.assignPermission(viewerRole!.id, permission.id)
		}
		console.log('✅ Permisos asignados\n')

		console.log('👤 Creando usuario administrador...')
		const existingUsers = await container.userRepository.findAll()
		const existingAdmin = existingUsers.find((u) => u.username === 'admin')

		if (!existingAdmin) {
			const randPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
			const adminUser = await container.createUserUseCase.execute({
				email: 'admin@agent.com',
				username: 'admin',
				password: randPassword,
				firstName: 'Admin',
				lastName: 'Agent'
			})
			await container.userRepository.assignRole(adminUser.id, adminRole!.id)
			console.log('✅ Usuario admin creado')
			console.log('   Email: admin@agent.com')
			console.log(`   Password: ${randPassword}\n`)
		} else {
			console.log('✅ Usuario admin ya existe\n')
		}

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
