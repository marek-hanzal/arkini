import { describe, expect, it } from "vitest";

import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("Blueprint default lines", () => {
	it("authors every blueprint's single construction line as its default", async () => {
		const config = await readArkiniGameConfigSource();
		const blueprints = Object.values(config.items).filter((item) => item.type === "blueprint");

		expect(blueprints.length).toBeGreaterThan(0);
		for (const blueprint of blueprints) {
			expect(blueprint.line.default, blueprint.id).toBe(true);
		}
	});
});
