import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("GameConfigSchema", () => {
	it("parses the current Arkini game configuration through the production compiler", async () => {
		const config = await readArkiniGameConfigSource();
		const result = GameConfigSchema.safeParse(config);

		expect(result.error?.issues).toBeUndefined();
	});
});
