import { RendererContentSecurityPolicy } from "../RendererContentSecurityPolicy";
import type { RendererDevelopmentUrl } from "../RendererDevelopmentUrl";

export namespace createRendererDevelopmentContentSecurityPolicyFn {
	export interface Props {
		readonly developmentUrl: RendererDevelopmentUrl;
		readonly nonce: string;
	}
}

/** Creates the development renderer CSP for one exact HMR endpoint and nonce. */
export const createRendererDevelopmentContentSecurityPolicyFn = ({
	developmentUrl,
	nonce,
}: createRendererDevelopmentContentSecurityPolicyFn.Props) =>
	[
		RendererContentSecurityPolicy.commonDirectives[0],
		`script-src 'self' 'nonce-${nonce}'`,
		...RendererContentSecurityPolicy.commonDirectives.slice(1),
		// Native audio stays on the app protocol while Vite owns the development document origin.
		"media-src 'self' blob: serakki://app",
		`connect-src 'self' blob: data: ${developmentUrl.webSocketEndpoint} serakki://app`,
	].join("; ");
