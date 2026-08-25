export const createArtifact = (contentHash: string, revision: number) => ({
	bytes: new Uint8Array([
		1,
		2,
	]),
	contentHash,
	diagnostics: [],
	filename: "editor-test.arkpack",
	game: "0.5.0",
	revision,
	version: "1.0",
});
