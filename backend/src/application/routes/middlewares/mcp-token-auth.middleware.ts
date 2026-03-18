import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@infra/service/passport.service.js";

export const mcpTokenAuthMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const token =
		(req.headers["x-mcp-token"] as string) ||
		(req.headers["mcp-token"] as string) ||
		(req.query.token as string) ||
		(req.query.mcp_token as string);

	if (!token) {
		return res.status(401).json({
			jsonrpc: "2.0",
			error: { code: -32000, message: "MCP token required" },
			id: req.body?.id || null,
		});
	}

	try {
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = payload;
		next();
	} catch {
		return res.status(401).json({
			jsonrpc: "2.0",
			error: { code: -32000, message: "Invalid or expired MCP token" },
			id: req.body?.id || null,
		});
	}
};
