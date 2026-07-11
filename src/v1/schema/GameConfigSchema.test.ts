import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";
import { GameConfigSchema } from "./GameConfigSchema";

const readGameConfig = () => {
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

describe("GameConfigSchema", () => {
	it("parses the current Arkini game configuration after source fragments are merged", () => {
		const config = readGameConfig();
		const result = GameConfigSchema.safeParse(config.value);

		expect(config.root).toBeDefined();
		expect(result.error?.issues).toBeUndefined();
	});
});
