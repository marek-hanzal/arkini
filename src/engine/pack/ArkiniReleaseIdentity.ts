declare const __ARKINI_RELEASE_ISSUER__: string | undefined;
declare const __ARKINI_RELEASE_IDENTITY__: string | undefined;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const ArkiniReleaseIdentityDefaults = {
	issuer: "https://token.actions.githubusercontent.com",
	identity: "https://github.com/marek-hanzal/arkini/.github/workflows/macos-prerelease.yml",
} as const;

export const createArkiniReleaseIdentity = ({
	identity,
	issuer,
}: {
	readonly identity: string;
	readonly issuer: string;
}) => ({
	issuer,
	subjectAlternativeName: new RegExp(`^${escapeRegExp(identity)}@refs/tags/[^/]+$`),
});

/** The one workflow whose keyless provenance this particular Arkini build trusts. */
export const ArkiniReleaseIdentity = createArkiniReleaseIdentity({
	issuer:
		typeof __ARKINI_RELEASE_ISSUER__ === "string"
			? __ARKINI_RELEASE_ISSUER__
			: ArkiniReleaseIdentityDefaults.issuer,
	identity:
		typeof __ARKINI_RELEASE_IDENTITY__ === "string"
			? __ARKINI_RELEASE_IDENTITY__
			: ArkiniReleaseIdentityDefaults.identity,
});
