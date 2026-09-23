import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { parseGameSourceFileFx } from "~/game-config-source/fx/parseGameSourceFileFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

describe("parseGameSourceFileFx", () => {
	it("projects structured game.json version parts into compiler provenance", () => {
		const { items: _items, ...config } = editorTestPayload.config;
		const result = Effect.runSync(
			parseGameSourceFileFx({
				path: "/project/game.json",
				relative: "game.json",
				source: JSON.stringify({
					$schema: GameProjectGameSchemaReference,
					version: {
						major: 4,
						minor: 2,
						suffix: "preview.1",
					},
					...config,
				}),
			}),
		);

		expect(result.diagnostics).toEqual([]);
		expect(result.projectIdentity).toEqual({
			packageId: config.meta.id,
			version: "4.2-preview.1",
		});
		expect(result.source?.value).not.toHaveProperty("version");
	});
});
