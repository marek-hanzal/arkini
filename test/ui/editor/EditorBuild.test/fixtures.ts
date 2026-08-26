export const createArtifact = (contentHash: string, revision: number) => ({
	projectId: "editor-test",
	bytes: 2,
	contentHash,
	diagnostics: [],
	filename: "editor-test.arkpack",
	game: "0.5.0",
	revision,
	version: "1.0",
});
