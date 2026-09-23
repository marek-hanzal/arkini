import { describe, expect, it } from "vitest";

import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

describe("readDeleteBlockersFn", () => {
	it("reports the exact project path that still references the item", () => {
		const blockers = readDeleteBlockersFn({
			config: editorTestConfig,
			itemUid: "water",
		});

		expect(blockers).toEqual([
			expect.objectContaining({
				path: [
					"templates",
					0,
					"board",
					0,
					"itemUid",
				],
			}),
		]);
	});

	it("ignores references owned by the deleted item but keeps incoming item references", () => {
		const merge = {
			action: "use" as const,
			effect: "keep" as const,
			target: {
				type: "item" as const,
				itemUid: "water",
			},
		};
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			templates: [
				{
					...editorTestConfig.templates![0]!,
					board: [],
				},
			],
			items: {
				water: {
					...editorTestConfig.items.water,
					merge: [
						merge,
					],
				},
				oil: {
					...editorTestConfig.items.water,
					uid: "oil",
					title: "Oil",
					merge: [
						merge,
					],
				},
			},
		});

		expect(
			readDeleteBlockersFn({
				config,
				itemUid: "water",
			}),
		).toEqual([
			expect.objectContaining({
				path: [
					"items",
					"oil",
					"merge",
					0,
					"target",
					"itemUid",
				],
			}),
		]);
	});
});
