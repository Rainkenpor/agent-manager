/**
 * Service scheduler for running periodic background tasks
 */

export interface ScheduledService {
	name: string;
	handler: () => Promise<void> | void;
	interval?: number; // milliseconds
	runOnStart?: boolean; // Run immediately on registration
	delay?: number; // milliseconds
	enabled?: boolean;
}

export class ServiceScheduler {
	private services: Map<string, ScheduledService> = new Map();
	private timers: Map<string, NodeJS.Timeout> = new Map();
	private running = false;

	/**
	 * Register a service to be executed periodically
	 */
	register(service: ScheduledService): this {
		if (this.services.has(service.name)) {
			console.warn(
				`⚠️  Service "${service.name}" is already registered. Replacing...`,
			);
			this.unregister(service.name);
		}

		const serviceWithDefaults = {
			...service,
			runOnStart: service.runOnStart ?? false,
			enabled: service.enabled ?? true,
		};

		this.services.set(service.name, serviceWithDefaults);
		console.log(
			`📝 Registered scheduled service: "${service.name}" (interval: ${service.interval}ms)`,
		);

		// If scheduler is already running and service should run on start, execute it
		if (this.running && serviceWithDefaults.enabled) {
			this.startService(service.name);
		}

		return this;
	}

	/**
	 * Chain method to register multiple services
	 */
	chain(service: ScheduledService): this {
		return this.register(service);
	}

	/**
	 * Unregister a service and stop its execution
	 */
	unregister(name: string): boolean {
		this.stopService(name);
		return this.services.delete(name);
	}

	/**
	 * Start all registered services
	 */
	startAll(): void {
		if (this.running) {
			console.log("⚠️  Scheduler is already running");
			return;
		}

		this.running = true;
		console.log("🔄 Starting all scheduled services...");

		for (const [name, service] of this.services) {
			if (service.enabled) {
				this.startService(name);
			}
		}

		console.log(
			`✅ Scheduler started with ${this.timers.size} active service(s)`,
		);
	}

	/**
	 * Start a specific service
	 */
	private startService(name: string): void {
		const service = this.services.get(name);
		if (!service || !service.enabled) return;

		// Run immediately if configured (always non-blocking)
		if (service.runOnStart) {
			const delay = service.delay || 0;
			setTimeout(() => {
				setImmediate(() => {
					this.executeService(name).catch((err) => {
						console.error(`❌ Error in initial run of "${name}":`, err.message);
					});
				});
			}, delay);
		}

		// Setup interval (executions are non-blocking)
		if (service.interval) {
			const timer = setInterval(() => {
				setImmediate(() => {
					this.executeService(name).catch((err) => {
						console.error(`❌ Error in service "${name}":`, err.message);
					});
				});
			}, service.interval);

			this.timers.set(name, timer);
		}
	}

	/**
	 * Stop a specific service
	 */
	private stopService(name: string): void {
		const timer = this.timers.get(name);
		if (timer) {
			clearInterval(timer);
			this.timers.delete(name);
			console.log(`⏹️  Stopped service: "${name}"`);
		}
	}

	/**
	 * Execute a service handler with error handling
	 */
	private async executeService(name: string): Promise<void> {
		const service = this.services.get(name);
		if (!service) return;

		try {
			await service.handler();
		} catch (error) {
			const err = error as Error;
			console.error(`❌ Error executing service "${name}":`, err.message);
		}
	}

	/**
	 * Stop all running services
	 */
	stopAll(): void {
		console.log("⏹️  Stopping all scheduled services...");
		for (const name of this.timers.keys()) {
			this.stopService(name);
		}
		this.running = false;
		console.log("✅ All scheduled services stopped");
	}

	/**
	 * Enable a specific service
	 */
	enable(name: string): boolean {
		const service = this.services.get(name);
		if (!service) return false;

		service.enabled = true;
		if (this.running) {
			this.startService(name);
		}
		return true;
	}

	/**
	 * Disable a specific service
	 */
	disable(name: string): boolean {
		const service = this.services.get(name);
		if (!service) return false;

		service.enabled = false;
		this.stopService(name);
		return true;
	}

	/**
	 * Get status of all services
	 */
	getStatus(): Record<
		string,
		{ enabled: boolean; running: boolean; interval?: number }
	> {
		const status: Record<
			string,
			{ enabled: boolean; running: boolean; interval?: number }
		> = {};

		for (const [name, service] of this.services) {
			status[name] = {
				enabled: service.enabled ?? true,
				running: this.timers.has(name),
				interval: service.interval,
			};
		}

		return status;
	}

	/**
	 * Get list of registered service names
	 */
	getServices(): string[] {
		return Array.from(this.services.keys());
	}
}

// Export singleton instance
export const serviceScheduler = new ServiceScheduler();
