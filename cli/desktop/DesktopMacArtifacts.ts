import packageJson from "../../package.json" with { type: "json" };

export const DesktopMacArtifacts = {
	names: [
		`Arkini-${packageJson.version}-mac-arm64.dmg`,
		`Arkini-${packageJson.version}-mac-arm64.zip`,
	],
} as const;

export namespace DesktopMacArtifacts {
	export type Name = (typeof DesktopMacArtifacts.names)[number];
}
