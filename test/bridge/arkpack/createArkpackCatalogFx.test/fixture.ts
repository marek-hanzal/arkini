import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

export const builtIn: ArkpackDescriptor = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
	gameId: "arkini",
	title: "Arkini",
	game: "1",
	trust: {
		type: "official",
		keyId: "test-official",
	},
	source: "bundled",
};

export const imported: ArkpackDescriptor = {
	packageId: "b".repeat(64),
	contentHash: "b".repeat(64),
	gameId: "imported",
	title: "Imported",
	game: "1",
	trust: {
		type: "external",
		reason: "unsigned",
	},
	source: "user",
};
