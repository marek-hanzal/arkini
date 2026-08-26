import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

export const builtIn: ArkpackDescriptor = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
	title: "Arkini",
	version: "1.0",
	arkini: "1",
	trust: {
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
	trust: {
		type: "external",
		reason: "unsigned",
	},
	source: "user",
};
