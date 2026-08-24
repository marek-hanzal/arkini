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

export const capacityDiagnostic = {
	code: "input:capacity-unsupported",
	severity: "error",
	path: [
		"items",
		"producer:academy",
		"lines",
		0,
		"inputs",
		0,
	],
	message: "This input buffer is only supported by producer lines.",
	ownerItemId: "producer:academy",
	lineId: "line:academy:knowledge",
	inputIndex: 0,
	capacity: 2,
} as const;
