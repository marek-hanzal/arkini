import { Effect } from "effect";
import { RendererContentSecurityPolicy } from "./RendererContentSecurityPolicy";
import type { RendererDevelopmentUrl } from "./RendererDevelopmentUrl";

export namespace createRendererDevelopmentContentSecurityPolicyFx {
	export interface Props {
		readonly developmentUrl: RendererDevelopmentUrl;
		readonly nonce: string;
	}
}

/** Creates the development renderer CSP for one exact HMR endpoint and nonce. */
export const createRendererDevelopmentContentSecurityPolicyFx = Effect.fn(
	"createRendererDevelopmentContentSecurityPolicyFx",
)(({ developmentUrl, nonce }: createRendererDevelopmentContentSecurityPolicyFx.Props) =>
	Effect.succeed(
		[
			RendererContentSecurityPolicy.commonDirectives[0],
			`script-src 'self' 'nonce-${nonce}'`,
			...RendererContentSecurityPolicy.commonDirectives.slice(1),
			`connect-src 'self' blob: data: ${developmentUrl.webSocketEndpoint}`,
		].join("; "),
	),
);
