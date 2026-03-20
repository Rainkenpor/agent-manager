import { z } from 'zod'
import { CreateRoleSchema, UpdateRoleSchema } from '@domain/entities/role.entity.js'
import { registry } from '@application/services/registry.service.js'

export function registerRoleRoutes() {
	// Crear rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles',
		method: 'POST',
		handler: async ({ context: { req, res } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				const role = await roleRepository.create(req.body)
				return role
			} catch (error: any) {
				res.status(400).json({ error: error.message })
			}
		},
		inputSchema: CreateRoleSchema,
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'create' }
	})

	// Listar roles
	registry.register({
		useBy: ['server'],
		path: '/api/roles',
		method: 'GET',
		handler: async ({ context: { req, res, next } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				const roles = await roleRepository.findAll()
				return roles
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'read' }
	})

	// Obtener rol por ID
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:id',
		method: 'GET',
		handler: async ({ input, context: { req, res, next } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				const role = await roleRepository.findById(input.id)
				if (!role) {
					return res.status(404).json({ error: 'Rol no encontrado' })
				}

				const permissions = await roleRepository.getPermissions(role.id)
				return { ...role, permissions }
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: z.object({ id: z.string() }),
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'read' }
	})

	// Actualizar rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:id',
		method: 'PUT',
		handler: async ({ context: { req, res, next } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				const role = await roleRepository.update(req.params.id, req.body)
				return role
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: UpdateRoleSchema,
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'update' }
	})

	// Eliminar rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:id',
		method: 'DELETE',
		handler: async ({ input, context: { res } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				await roleRepository.delete(input.id)
				return { success: true, message: 'Rol eliminado correctamente' }
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: z.object({ id: z.string() }),
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'delete' }
	})

	// Listar todos los permisos del sistema
	registry.register({
		useBy: ['server'],
		path: '/api/permissions',
		method: 'GET',
		handler: async ({ context: { res } }) => {
			const { container } = await import('@application/container.js')
			const permissionRepository = container.permissionRepository
			try {
				const perms = await permissionRepository.findAll()
				return perms
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		requiresAuth: true,
		requiredPermission: { resource: 'permissions', action: 'read' }
	})

	// Listar permisos de un rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:id/permissions',
		method: 'GET',
		handler: async ({ input, context: { res } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository
			try {
				const perms = await roleRepository.getPermissions(input.id)
				return perms
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: z.object({ id: z.string() }),
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'read' }
	})

	// Asignar permiso a rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:roleId/permissions/:permissionId',
		method: 'POST',
		handler: async ({ input, context: { res } }) => {
			const { container } = await import('@application/container.js')
			const assignPermissionUseCase = container.assignPermissionUseCase

			try {
				await assignPermissionUseCase.execute({
					roleId: input.roleId,
					permissionId: input.permissionId
				})
				return { message: 'Permiso asignado exitosamente' }
			} catch (error: any) {
				res.status(400).json({ error: error.message })
			}
		},
		inputSchema: z.object({
			roleId: z.string(),
			permissionId: z.string()
		}),
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'assign_permission' }
	})

	// Remover permiso de rol
	registry.register({
		useBy: ['server'],
		path: '/api/roles/:roleId/permissions/:permissionId',
		method: 'DELETE',
		handler: async ({ input, context: { res } }) => {
			const { container } = await import('@application/container.js')
			const roleRepository = container.roleRepository

			try {
				await roleRepository.removePermission(input.roleId, input.permissionId)
				return { success: true, message: 'Permiso eliminado correctamente' }
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: z.object({
			roleId: z.string(),
			permissionId: z.string()
		}),
		requiresAuth: true,
		requiredPermission: { resource: 'roles', action: 'assign_permission' }
	})
}
