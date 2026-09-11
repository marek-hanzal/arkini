import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { renameGameResourceFx } from "~/game-config-resource/fx/renameGameResourceFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";
import { readEditorAssetDeleteBlockersFn } from "~/asset-authoring/fn/readEditorAssetDeleteBlockersFn";

describe("renameGameResourceFx", () => {
	it("renames project and item references without changing unrelated identities", () => {
		const ignore = {
			type: "ignore",
		};
		const rule = NeighborhoodArtworkRuleSchema.parse({
			sourceId: "hero",
			neighbors: {
				nw: ignore,
				n: {
					type: "item",
					itemId: "water",
				},
				ne: ignore,
				w: ignore,
				e: ignore,
				sw: ignore,
				s: ignore,
				se: ignore,
			},
		});
		const config = {
			...editorTestPayload.config,
			items: {
				...editorTestPayload.config.items,
				water: {
					...editorTestPayload.config.items.water,
					asset: {
						neighbors: [
							rule,
						],
						scale: 0.8,
						default: [
							"hero",
						] as [
							string,
						],
						sources: [
							"hero",
							"item-water",
						],
					},
				},
			},
		};
		const renamed = Effect.runSync(
			renameGameResourceFx({
				config,
				from: "hero",
				to: "cover",
			}),
		);

		expect(renamed.resources.hero).toBe("cover");
		expect(renamed.items.water?.asset.default).toEqual([
			"cover",
		]);
		expect(renamed.items.water?.asset.sources).toEqual([
			"cover",
			"item-water",
		]);
		expect(renamed.items.water?.id).toBe("water");
		expect(renamed.items.water?.asset.neighbors).toEqual([
			{
				...rule,
				sourceId: "cover",
			},
		]);
		expect(config.items.water.asset.neighbors[0]).toEqual(rule);
		expect(
			readEditorAssetDeleteBlockersFn({
				config: renamed,
				resourceId: "cover",
			}),
		).toContainEqual(
			expect.objectContaining({
				path: [
					"items",
					"water",
					"asset",
					"neighbors",
					0,
					"sourceId",
				],
			}),
		);
	});
});
