import Ajv2020 from "ajv/dist/2020";
import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createProducerItem } from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { GameProjectItemSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { parseGameSourceFileFx } from "~/game-config-source/fx/parseGameSourceFileFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

describe("parseGameSourceFileFx", () => {
	it("refuses a Common action-production conflict with exact compiler source provenance", () => {
		const validate = new Ajv2020({
			strict: false,
		}).compile(GameProjectJsonSchema);
		const production = createProducerItem({
			id: "portal",
		});
		const action = {
			type: "space",
			space: 1,
			input: [],
			rules: [],
		};
		const document = {
			$schema: GameProjectItemSchemaReference,
			item: {
				...production,
				action,
			},
		};
		expect(validate(document)).toBe(false);
		expect(
			validate({
				...document,
				item: production,
			}),
		).toBe(true);
		expect(
			validate({
				...document,
				item: {
					...production,
					lines: [],
					action,
				},
			}),
		).toBe(true);
		expect(
			validate({
				...document,
				item: {
					...production,
					lines: [],
				},
			}),
		).toBe(true);
		const path = "/project/items/portal.json";
		const result = Effect.runSync(
			parseGameSourceFileFx({
				path,
				relative: "items/portal.json",
				source: JSON.stringify(document),
			}),
		);
		expect(result.source).toBeUndefined();
		expect(result.diagnostics).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
				severity: "error",
				source: path,
				path: [
					"item",
					"action",
				],
			}),
		]);
	});

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
