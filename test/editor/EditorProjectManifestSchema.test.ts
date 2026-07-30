import { describe, expect, it } from "vitest";

import { EditorProjectManifestSchema } from "../../electron/contract/editor/EditorProjectManifest";

const manifest = {
	projectId: "arkini",
	title: "Arkini",
	game: "1.0",
	createdAtMs: 100,
	updatedAtMs: 200,
} as const;

describe("EditorProjectManifestSchema", () => {
	it("accepts only the compact editor.json contract", () => {
		expect(EditorProjectManifestSchema.parse(manifest)).toEqual(manifest);
		expect(
			EditorProjectManifestSchema.safeParse({
				...manifest,
				format: 1,
			}).success,
		).toBe(false);
		expect(
			EditorProjectManifestSchema.safeParse({
				...manifest,
				formatVersion: 1,
				gameVersion: manifest.game,
			}).success,
		).toBe(false);
	});
});
