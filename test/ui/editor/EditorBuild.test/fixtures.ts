import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

export const createArtifact = (contentHash: string, revision: number) => ({
	projectId: "editor-test",
	bytes: 2,
	contentHash,
	diagnostics: [],
	filename: "editor-test.arkpack",
	arkini: ArkiniAppVersion,
	revision,
	version: "1.0",
});
