export interface AiAssistInput {
	content: string
	request: string
	systemPrompt?: string
}

export type AiAssistSseEvent =
	| { type: 'chunk'; content: string }
	| { type: 'done'; content: string }
	| { type: 'error'; error: string }
