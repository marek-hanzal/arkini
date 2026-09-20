declare const __SERAKKI_RELEASE_ISSUER__: string | undefined;
declare const __SERAKKI_RELEASE_IDENTITY__: string | undefined;

export const SerapackDistributionChannelDefaults = {
	issuer: "https://token.actions.githubusercontent.com",
	workflow: "https://github.com/marek-hanzal/serakki/.github/workflows/release.yml",
} as const;

const escapeRegExpFn = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createSerapackDistributionChannelFn = ({
	issuer,
	workflow,
}: {
	readonly issuer: string;
	readonly workflow: string;
}) => ({
	issuer,
	subjectAlternativeName: new RegExp(`^${escapeRegExpFn(workflow)}@.+$`),
});

/** The one repository workflow channel whose keyless provenance this build trusts. */
export const SerapackDistributionChannel = createSerapackDistributionChannelFn({
	issuer:
		typeof __SERAKKI_RELEASE_ISSUER__ === "string"
			? __SERAKKI_RELEASE_ISSUER__
			: SerapackDistributionChannelDefaults.issuer,
	workflow:
		typeof __SERAKKI_RELEASE_IDENTITY__ === "string"
			? __SERAKKI_RELEASE_IDENTITY__
			: SerapackDistributionChannelDefaults.workflow,
});
