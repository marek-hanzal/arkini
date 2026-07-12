import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { validateGameResourcesFx } from "~/v1/validation/rule/validateGameResourcesFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";

const provenance = {
	resources: "game.json",
	categories: {},
	items: Object.fromEntries(
		Object.keys(startTestConfig.items).map((id) => [
			id,
			`${id}.json`,
		]),
	),
};

describe("validateGameResourcesFx", () => {
	it("accepts exact filename resource IDs", () => {
		const ids = new Set<string>([
			startTestConfig.resources.hero,
		]);
		for (const item of Object.values(startTestConfig.items)) {
			if (item.type === "blueprint") item.asset.forEach((id) => ids.add(id));
			else item.asset.source.forEach((id) => ids.add(id));
		}
		const diagnostics = Effect.runSync(
			validateGameResourcesFx({
				config: startTestConfig,
				provenance,
				resources: [
					...ids,
				].map((id) => ({
					id,
					path: `${id}.png`,
					mime: "image/png" as const,
				})),
			}),
		);

		expect(diagnostics).toEqual([]);
	});

	it("reports duplicate and missing exact resource IDs", () => {
		const diagnostics = Effect.runSync(
			validateGameResourcesFx({
				config: startTestConfig,
				provenance,
				resources: [
					{
						id: "hero",
						path: "a/hero.png",
						mime: "image/png",
					},
					{
						id: "hero",
						path: "b/hero.png",
						mime: "image/png",
					},
				],
			}),
		);

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "resource:duplicate",
					resourceId: "hero",
				}),
				expect.objectContaining({
					code: "resource:missing",
				}),
			]),
		);
	});
});
