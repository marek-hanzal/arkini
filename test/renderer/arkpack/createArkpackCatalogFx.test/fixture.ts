import type { ArkpackDescriptor } from "~/engine/pack/Arkpack";

export const builtIn: ArkpackDescriptor = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
	title: "Arkini",
	version: "1.0",
	arkini: "1",
	provenance: {
		type: "official",
	},
	source: "bundled",
};

export const imported: ArkpackDescriptor = {
	packageId: "b".repeat(64),
	contentHash: "b".repeat(64),
	title: "Imported",
	version: "1.0",
	arkini: "1",
	provenance: {
		type: "community",
	},
	source: "user",
};
