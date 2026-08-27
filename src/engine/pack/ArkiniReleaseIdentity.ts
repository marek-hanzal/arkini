declare const __ARKINI_RELEASE_ISSUER__: string | undefined;
declare const __ARKINI_RELEASE_SUBJECT__: string | undefined;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const ArkiniReleaseIdentityDefaults = {
	issuer: "https://token.actions.githubusercontent.com",
	subject: "https://github.com/marek-hanzal/arkini/.github/workflows/macos-prerelease.yml",
} as const;

export const createArkiniReleaseIdentity = ({
	issuer,
	subject,
}: {
	readonly issuer: string;
	readonly subject: string;
}) => ({
	issuer,
	workflow: new RegExp(`^${escapeRegExp(subject)}@refs/tags/[^/]+$`),
});

/** The one workflow whose keyless provenance this particular Arkini build trusts. */
export const ArkiniReleaseIdentity = createArkiniReleaseIdentity({
	issuer:
		typeof __ARKINI_RELEASE_ISSUER__ === "string"
			? __ARKINI_RELEASE_ISSUER__
			: ArkiniReleaseIdentityDefaults.issuer,
	subject:
		typeof __ARKINI_RELEASE_SUBJECT__ === "string"
			? __ARKINI_RELEASE_SUBJECT__
			: ArkiniReleaseIdentityDefaults.subject,
});
