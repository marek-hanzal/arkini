import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "~test/schema/support/readArkiniGameSources";
import { GameSourceSchema } from "~/v1/schema/GameSourceSchema";

describe("GameSourceSchema", () => {
	it("parses every current Arkini authoring fragment independently", () => {
		for (const source of readArkiniGameSources()) {
			const result = GameSourceSchema.safeParse(source.value);

			expect(result.error?.issues, source.path).toBeUndefined();
		}
	});
});
