import { describe, expect, it } from "vitest";

import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";

const metadata = {
	packageId: "arkini",
	hash: "a".repeat(64),
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
				format: 1,
				namespace: "arkini",
				configVersion: metadata.game,
				compressedSize: 123,
				contentHash: metadata.hash,
			}).success,
		).toBe(false);
	});
});
