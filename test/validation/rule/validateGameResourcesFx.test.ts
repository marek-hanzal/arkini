import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { validateGameResourcesFx } from "~/engine/validation/rule/validateGameResourcesFx";
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
			item.asset.source.forEach((id) => ids.add(id));
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

	it("validates only configured optional anonymous avatar roles", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			resources: {
				...startTestConfig.resources,
				"avatar-02": "avatar-02",
			},
		});
		const diagnostics = Effect.runSync(
			validateGameResourcesFx({
				config,
				provenance,
				resources: [
					{
						id: "hero",
						path: "hero.png",
						mime: "image/png" as const,
					},
				],
			}),
		);

		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: "resource:missing",
				resourceId: "avatar-02",
				path: [
					"resources",
					"avatar-02",
				],
			}),
		);
		expect(
			diagnostics.some(
				(diagnostic) =>
					diagnostic.code === "resource:missing" &&
					[
						"avatar-01",
						"avatar-03",
						"avatar-04",
						"avatar-05",
						"avatar-06",
						"avatar-07",
					].includes(diagnostic.resourceId),
			),
		).toBe(false);
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

	it("allows multiple blueprints to reference one explicit shared visual", () => {
		const blueprintItem = ({
			id,
			targetId,
			targetAsset,
		}: {
			id: string;
			targetId: string;
			targetAsset: string;
		}) => ({
			id,
			type: "blueprint" as const,
			charges: {
				amount: 1,
			},
			title: id,
			description: id,
			asset: {
				source: [
					"blueprint",
					targetAsset,
				] as const,
			},
			tags: [],
			categoryId: "blueprint",
			scope: "any" as const,
			maxStackSize: 1,
			line: {
				id: `line:${id}:construct`,
				title: id,
				description: id,
				runtimeMs: 0,
				input: [
					{
						type: "simple" as const,
					},
				],
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed" as const,
									drop: [
										{
											itemId: targetId,
											quantity: {
												type: "value" as const,
												value: 1,
											},
											placement: "drop" as const,
											rules: [],
										},
									],
								},
							],
						},
					],
				},
				rules: [],
			},
		});
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				"blueprint:tree": blueprintItem({
					id: "blueprint:tree",
					targetId: "tree",
					targetAsset: "asset:tree",
				}),
				"blueprint:log": blueprintItem({
					id: "blueprint:log",
					targetId: "log",
					targetAsset: "asset:log",
				}),
			},
		});
		const diagnostics = Effect.runSync(
			validateGameResourcesFx({
				config,
				provenance: {
					...provenance,
					items: Object.fromEntries(
						Object.keys(config.items).map((id) => [
							id,
							`${id}.json`,
						]),
					),
				},
				resources: [
					"hero",
					"asset:tree",
					"asset:log",
					"asset:lens",
					"blueprint",
				].map((id) => ({
					id,
					path: `${id}.png`,
					mime: "image/png" as const,
				})),
			}),
		);

		expect(diagnostics).toEqual([]);
	});
});
