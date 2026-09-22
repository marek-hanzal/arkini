import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";

export const builtIn: SerapackDescriptor = {
	packageId: "serakki",
	contentHash: "a".repeat(64),
	title: "Serakki",
	version: "1.0",
	serakki: "1",
	projectRevision: 1,
	provenance: {
		type: "official",
	},
	source: "bundled",
};

export const imported: SerapackDescriptor = {
	packageId: "b".repeat(64),
	contentHash: "b".repeat(64),
	title: "Imported",
	version: "1.0",
	serakki: "1",
	projectRevision: 1,
	provenance: {
		type: "community",
	},
	source: "user",
};
