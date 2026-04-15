export type EventListenerOperator =
	| '=='
	| '==='
	| '!='
	| '!=='
	| '>'
	| '<'
	| '>='
	| '<='
	| 'contains'
	| 'startsWith'
	| 'endsWith'

export interface EventListenerSource {
	/** Tool name in the registry. Format: mcp__{serverName}__{toolName}, e.g. "mcp__jira__get_issues" */
	function_name: string
	params: Record<string, unknown>
}

export interface EventListenerCondition {
	field: string // dot-path relative to element, e.g. "element.status.name"
	operator: EventListenerOperator
	value: unknown
}

export interface EventListenerAction {
	/** Tool name in the registry. Format: mcp__{serverName}__{toolName}, e.g. "mcp__slack__send_message" */
	function_name: string
	params: Record<string, unknown>
}

export interface EventListener {
	id: string
	name: string
	schedule: string // cron expression
	source: EventListenerSource
	condition: EventListenerCondition
	action: EventListenerAction[]
	enabled: boolean
	lastRunAt: string | null
	lastRunResult: string | null
	createdAt: string
	updatedAt: string
}

export interface CreateEventListenerDTO {
	name: string
	schedule: string
	source: EventListenerSource
	condition: EventListenerCondition
	action: EventListenerAction[]
	enabled?: boolean
}

export interface UpdateEventListenerDTO {
	id: string
	name?: string
	schedule?: string
	source?: EventListenerSource
	condition?: EventListenerCondition
	action?: EventListenerAction[]
	enabled?: boolean
}
