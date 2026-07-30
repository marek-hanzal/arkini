import { describe, expect, it } from "vitest";

import { EditorProjectManifestSchema } from "../../electron/contract/editor/EditorProjectManifest";

const manifest = {
	format: 1,
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
				formatVersion: manifest.format,
				gameVersion: manifest.game,
			}).success,
		).toBe(false);
	});
});
