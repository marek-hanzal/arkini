declare const __ARKINI_RELEASE_ISSUER__: string | undefined;
declare const __ARKINI_RELEASE_IDENTITY__: string | undefined;

import { createArkpackDistributionChannelFn } from "./fn/createArkpackDistributionChannelFn";

export const ArkpackDistributionChannelDefaults = {
	issuer: "https://token.actions.githubusercontent.com",
	workflow: "https://github.com/marek-hanzal/arkini/.github/workflows/release.yml",
} as const;

/** The one repository workflow channel whose keyless provenance this build trusts. */
export const ArkpackDistributionChannel = createArkpackDistributionChannelFn({
	issuer:
		typeof __ARKINI_RELEASE_ISSUER__ === "string"
			? __ARKINI_RELEASE_ISSUER__
			: ArkpackDistributionChannelDefaults.issuer,
	workflow:
		typeof __ARKINI_RELEASE_IDENTITY__ === "string"
			? __ARKINI_RELEASE_IDENTITY__
			: ArkpackDistributionChannelDefaults.workflow,
});
