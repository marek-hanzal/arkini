import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "./GameConfigSchema";
import { readArkiniGameConfigSource } from "./test/readArkiniGameConfigSource";

describe("GameConfigSchema", () => {
	it("parses the current Arkini game configuration after source fragments are merged", () => {
		const config = readArkiniGameConfigSource();
		const result = GameConfigSchema.safeParse(config.value);

		expect(config.root).toBeDefined();
		expect(result.error?.issues).toBeUndefined();
	});
});
