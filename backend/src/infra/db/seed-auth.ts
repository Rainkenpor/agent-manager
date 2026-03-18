import { container } from "../../application/container.js";

async function seed() {
	console.log("🌱 Sembrando datos iniciales...\n");

	try {
		// 1. Crear permisos por defecto
		console.log("📜 Creando permisos...");
		await container.permissionRepository.seedDefaultPermissions();
		console.log("✅ Permisos creados\n");

		// 2. Crear roles
		console.log("👥 Creando roles...");
		const allRoles = await container.roleRepository.findAll();
		let adminRole = allRoles.find((r) => r.name === "admin");
		let editorRole = allRoles.find((r) => r.name === "editor");
		let viewerRole = allRoles.find((r) => r.name === "viewer");

		if (!adminRole) {
			adminRole = await container.roleRepository.create({
				name: "admin",
				description: "Administrador con todos los permisos",
			});
		}

		if (!editorRole) {
			editorRole = await container.roleRepository.create({
				name: "editor",
				description: "Editor que puede crear y modificar documentación",
			});
		}

		if (!viewerRole) {
			viewerRole = await container.roleRepository.create({
				name: "viewer",
				description: "Usuario que solo puede ver documentación",
			});
		}
		console.log("✅ Roles verificados/creados\n");

		// 3. Asignar todos los permisos al rol admin
		console.log("🔐 Asignando permisos a roles...");
		const allPermissions = await container.permissionRepository.findAll();

		// Remover permisos de roles existentes
		if (adminRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(
					adminRole.id,
					permission.id,
				);
			}
		}
		if (editorRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(
					editorRole.id,
					permission.id,
				);
			}
		}
		if (viewerRole) {
			for (const permission of allPermissions) {
				await container.roleRepository.removePermission(
					viewerRole.id,
					permission.id,
				);
			}
		}

		for (const permission of allPermissions) {
			await container.roleRepository.assignPermission(
				adminRole.id,
				permission.id,
			);
		}

		// Editor: permisos de lectura y escritura de proyectos y secciones
		const editorPermissions = allPermissions.filter(
			(p) =>
				(p.resource === "projects" || p.resource === "sections") &&
				["create", "read", "update"].includes(p.action),
		);
		for (const permission of editorPermissions) {
			await container.roleRepository.assignPermission(
				editorRole.id,
				permission.id,
			);
		}

		// Viewer: solo lectura
		const viewerPermissions = allPermissions.filter((p) => p.action === "read");
		for (const permission of viewerPermissions) {
			await container.roleRepository.assignPermission(
				viewerRole.id,
				permission.id,
			);
		}
		console.log("✅ Permisos asignados\n");

		// 4. Crear usuario admin
		console.log("👤 Creando usuario administrador...");
		const existingUsers = await container.userRepository.findAll();
		const existingAdmin = existingUsers.find((u) => u.username === "admin");

		if (!existingAdmin) {
			const adminUser = await container.createUserUseCase.execute({
				email: "admin@clarify.com",
				username: "admin",
				password: "admin123",
				firstName: "Admin",
				lastName: "Clarify",
			});

			await container.userRepository.assignRole(adminUser.id, adminRole.id);
			console.log("✅ Usuario admin creado");
			console.log("   Email: admin@clarify.com");
			console.log("   Password: admin123\n");
		} else {
			console.log("✅ Usuario admin ya existe\n");
		}

		console.log("✅ Seed completado exitosamente!");
	} catch (error: any) {
		console.error("❌ Error durante el seed:", error.message);
		process.exit(1);
	}
}

seed();
