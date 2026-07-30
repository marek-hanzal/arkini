import { describe, expect, it } from "vitest";

import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";

const metadata = {
	format: 1,
	packageId: "arkini",
	contentHash: "a".repeat(64),
	gameId: "arkini",
	title: "Arkini",
	game: "1.0",
} as const;

describe("ArkpackMetadataSchema", () => {
	it("accepts only the compact metadata contract", () => {
		expect(ArkpackMetadataSchema.parse(metadata)).toEqual(metadata);
		expect(
			ArkpackMetadataSchema.safeParse({
				...metadata,
				namespace: "arkini",
				configVersion: metadata.game,
				compressedSize: 123,
			}).success,
		).toBe(false);
	});
});
