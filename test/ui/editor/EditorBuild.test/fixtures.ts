export const createArtifact = (contentHash: string, revision: number) => ({
	projectId: "editor-test",
	contentHash,
	diagnostics: [],
	revision,
	size: 2,
});
