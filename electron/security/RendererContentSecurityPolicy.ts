const commonDirectives = [
	"default-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' blob: data: serakki://app",
	"font-src 'self' data:",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'none'",
] as const;

export const RendererContentSecurityPolicy = {
	commonDirectives,
	production: [
		commonDirectives[0],
		"script-src 'self'",
		...commonDirectives.slice(1),
		"media-src 'self' blob:",
		"connect-src 'self' blob: data: serakki://app",
	].join("; "),
} as const;
