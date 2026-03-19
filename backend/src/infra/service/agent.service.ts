import type {
	IAgentService,
	IAgentServiceExecute,
} from "@domain/entities/agent.entity.js";
import { InternalAgentService } from "./internal.js";

export class AgentService implements IAgentService {
	async executeAgent(params: IAgentServiceExecute): Promise<any> {
		return this.initAgent(params);
	}

	async initAgent(params: IAgentServiceExecute): Promise<any> {
			return new InternalAgentService().executeAgent(params);
	}

	async *initAgentStream(params: IAgentServiceExecute): AsyncGenerator<any> {
			yield* new InternalAgentService().executeAgentStream(params);
	}
}
