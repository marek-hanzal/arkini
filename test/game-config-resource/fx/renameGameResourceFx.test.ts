import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { renameGameResourceFx } from "~/game-config-resource/fx/renameGameResourceFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

describe("renameGameResourceFx", () => {
	it("renames project and item references without changing unrelated identities", () => {
		const config = {
			...editorTestPayload.config,
			music: {
				playlist: [
					"hero",
				],
			},
			sfx: {
				events: {
					"job:started": "hero",
				},
			},
			items: {
				...editorTestPayload.config.items,
				water: {
					...editorTestPayload.config.items.water,
					music: "hero",
					lines: [
						LineSchema.parse({
							id: "gather",
							title: "Gather",
							description: "Gather water",
							artwork: "hero",
							runtimeMs: 0,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
						}),
						LineSchema.parse({
							id: "other",
							title: "Other",
							description: "Other work",
							runtimeMs: 0,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
						}),
					],
					artwork: {
						scale: 0.8,
						default: [
							"hero",
							"item-water",
						] as [
							string,
							string,
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

		expect(renamed.items.water?.music).toBe("cover");
		expect(renamed.resources.hero).toBe("cover");
		expect(renamed.music?.playlist).toEqual([
			"cover",
		]);
		expect(renamed.sfx?.events["job:started"]).toBe("cover");
		expect(renamed.items.water?.artwork.default).toEqual([
			"cover",
			"item-water",
		]);
		expect(renamed.items.water?.lines[0]?.artwork).toBe("cover");
		expect(renamed.items.water?.lines[1]).not.toHaveProperty("artwork");
		expect(config.items.water.lines[0]?.artwork).toBe("hero");
		expect(renamed.items.water?.id).toBe("water");
	});
});
