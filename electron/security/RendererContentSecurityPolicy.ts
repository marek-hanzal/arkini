import type { RendererDevelopmentUrl } from "./RendererDevelopmentUrl";

const commonDirectives = [
	"default-src 'self'",
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

export namespace createRendererDevelopmentContentSecurityPolicy {
	export interface Props {
		readonly developmentUrl: RendererDevelopmentUrl;
		readonly nonce: string;
	}
}

export const createRendererDevelopmentContentSecurityPolicy = ({
	developmentUrl,
	nonce,
}: createRendererDevelopmentContentSecurityPolicy.Props) =>
	[
		commonDirectives[0],
		`script-src 'self' 'nonce-${nonce}'`,
		...commonDirectives.slice(1),
		`connect-src 'self' ${developmentUrl.webSocketEndpoint}`,
	].join("; ");

export const RendererContentSecurityPolicy = {
	production: [
		commonDirectives[0],
		"script-src 'self'",
		...commonDirectives.slice(1),
		"connect-src 'self'",
	].join("; "),
} as const;
