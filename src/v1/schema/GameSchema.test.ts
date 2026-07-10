import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";
import { GameSchema } from "./GameSchema";

const readGame = () => {
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

	return {
		root,
		value: {
			...(root?.value as object),
			items,
		},
	};
};

describe("GameSchema", () => {
	it("parses the current Arkini game configuration after source fragments are merged", () => {
		const game = readGame();
		const result = GameSchema.safeParse(game.value);

		expect(game.root).toBeDefined();
		expect(result.error?.issues).toBeUndefined();
	});
});
