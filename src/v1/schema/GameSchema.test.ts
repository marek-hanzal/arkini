import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";
import { GameSchema } from "./GameSchema";

describe("GameSchema", () => {
	it("parses the current Arkini game configuration after source fragments are merged", () => {
		const sources = readArkiniGameSources();
		const root = sources.find(({ path }) => path.endsWith("/game.json"));
		const items = sources.reduce<Record<string, unknown>>((result, source) => {
			const value = source.value as {
				readonly items?: Record<string, unknown>;
			};

			return {
				...result,
				...value.items,
			};
		}, {});
		const result = GameSchema.safeParse({
			...(root?.value as object),
			items,
		});

		expect(root).toBeDefined();
		expect(result.error?.issues).toBeUndefined();
	});
});
