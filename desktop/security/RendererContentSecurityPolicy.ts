const commonDirectives = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' blob: data:",
	"font-src 'self' data:",
	"media-src 'self' blob:",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'none'",
] as const;

export const RendererDevelopmentServer = {
	host: "127.0.0.1",
	port: 4040,
	origin: "http://127.0.0.1:4040",
	webSocketOrigin: "ws://127.0.0.1:4040",
} as const;

export const RendererContentSecurityPolicy = {
	development: [
		...commonDirectives,
		`connect-src 'self' ${RendererDevelopmentServer.webSocketOrigin}`,
	].join("; "),
	production: [
		...commonDirectives,
		"connect-src 'self'",
	].join("; "),
} as const;
