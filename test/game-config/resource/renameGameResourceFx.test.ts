import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { renameGameResourceFx } from "~/game-config/resource/renameGameResourceFx";
import { editorTestPayload } from "../../project-authoring/support/editorTestPayload";

describe("renameGameResourceFx", () => {
	it("renames project and item references without changing unrelated identities", () => {
		const config = {
			...editorTestPayload.config,
			items: {
				...editorTestPayload.config.items,
				water: {
					...editorTestPayload.config.items.water,
					asset: {
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
	});
});
