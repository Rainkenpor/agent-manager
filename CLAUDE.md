# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Session Initialization

**At the start of every session**, before responding to any request, you MUST call the `get_governance` tool with type `"agentManager"` to load the project governance rules:

```
get_governance({ type: "agentManager" })
```

- If the tool call **succeeds**: apply all active rules returned for the rest of the session.
- If the tool call **fails** or is unavailable: notify the user immediately with the message _"No es posible continuar: no se pudo obtener la gobernanza del proyecto. Verifica que el servidor MCP esté disponible."_ and do not proceed with any task.
