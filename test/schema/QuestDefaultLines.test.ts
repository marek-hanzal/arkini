import { describe, expect, it } from "vitest";

import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("Quest default lines", () => {
	it("authors every quest's line as its default", async () => {
		const config = await readArkiniGameConfigSource();
		let questCount = 0;

		for (const item of Object.values(config.items)) {
			if (item.type !== "craft" || item.categoryId !== "quest") {
				continue;
			}

			questCount += 1;
			expect(item.line.default, item.id).toBe(true);
		}

		expect(questCount).toBeGreaterThan(0);
	});
});
