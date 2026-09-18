import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { validateGameResourcesFn } from "~/game-config-validation/fn/validateGameResourcesFn";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const provenance = {
	resources: "game.json",
	items: Object.fromEntries(
		Object.keys(startTestConfig.items).map((id) => [
			id,
			`${id}.json`,
		]),
	),
};

const projectImageIds = new Set(Object.values(startTestConfig.resources));
const readResourceTypeFn = (id: string) => (projectImageIds.has(id) ? "image" : "artwork");

describe("validateGameResourcesFn", () => {
	it("validates optional production line artwork with exact item and line provenance", () => {
		const [itemId, item] = Object.entries(startTestConfig.items)[0]!;
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemId]: {
					...item,
					lines: [
						{
							id: "gather",
							title: "Gather",
							description: "Gather resources",
							artwork: "line-art",
							runtimeMs: 0,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
						},
					],
				},
			},
		});
		for (const type of [
			undefined,
			"image",
			"artwork",
		] as const) {
			const diagnostics = validateGameResourcesFn({
				config,
				provenance,
				resources:
					type === undefined
						? []
						: [
								{
									id: "line-art",
									path: `${type}/line-art.png`,
									type,
								},
							],
			}).filter(
				(diagnostic) => "resourceId" in diagnostic && diagnostic.resourceId === "line-art",
			);
			if (type === "artwork") expect(diagnostics).toEqual([]);
			else
				expect(diagnostics).toEqual([
					expect.objectContaining({
						code:
							type === undefined
								? DiagnosticCodeEnumSchema.enum.ResourceMissing
								: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
						path: [
							"items",
							itemId,
							"lines",
							0,
							"artwork",
						],
						source: `${itemId}.json`,
					}),
				]);
		}
	});

	it("validates item detail music against Music sources with item provenance", () => {
		const [itemId, item] = Object.entries(startTestConfig.items)[0]!;
		const config = {
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemId]: {
					...item,
					music: "detail-track",
				},
			},
		};
		for (const resources of [
			[],
			[
				{
					id: "detail-track",
					path: "sfx/detail-track.ogg",
					type: "sfx" as const,
				},
			],
		]) {
			const diagnostics = validateGameResourcesFn({
				config,
				provenance,
				resources,
			});
			expect(diagnostics).toContainEqual(
				expect.objectContaining({
					code:
						resources.length === 0
							? DiagnosticCodeEnumSchema.enum.ResourceMissing
							: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					resourceId: "detail-track",
					path: [
						"items",
						itemId,
						"music",
					],
					source: `${itemId}.json`,
				}),
			);
		}
		expect(
			validateGameResourcesFn({
				config,
				provenance,
				resources: [
					{
						id: "detail-track",
						path: "music/detail-track.ogg",
						type: "music",
					},
				],
			}).filter(
				(diagnostic) =>
					"resourceId" in diagnostic && diagnostic.resourceId === "detail-track",
			),
		).toEqual([]);
	});

	it("accepts exact filename resource IDs", () => {
		const ids = new Set<string>([
			startTestConfig.resources.hero,
		]);
		for (const item of Object.values(startTestConfig.items)) {
			item.artwork.default.forEach((id) => ids.add(id));
		}
		const diagnostics = validateGameResourcesFn({
			config: startTestConfig,
			provenance,
			resources: [
				...ids,
			].map((id) => ({
				id,
				path: `${id}.png`,
				type: readResourceTypeFn(id),
			})),
		});

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
		const diagnostics = validateGameResourcesFn({
			config,
			provenance,
			resources: [
				{
					id: "hero",
					path: "hero.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
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
					diagnostic.code === DiagnosticCodeEnumSchema.enum.ResourceMissing &&
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

	it("requires every random playlist entry to resolve to Music", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			music: {
				playlist: [
					"missing-theme",
					"wrong-theme",
				],
			},
		});
		const diagnostics = validateGameResourcesFn({
			config,
			provenance: {
				...provenance,
				music: "game.json",
			},
			resources: [
				{
					id: "wrong-theme",
					path: "image/wrong-theme.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
					path: [
						"music",
						"playlist",
						0,
					],
					resourceId: "missing-theme",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "music",
					resourceId: "wrong-theme",
					source: "game.json",
				}),
			]),
		);
	});

	it("requires every gameplay-event assignment to resolve to SFX", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			sfx: {
				events: {
					"job:started": "missing-job-start",
					"item:spawned": "wrong-spawn",
				},
			},
		});
		const diagnostics = validateGameResourcesFn({
			config,
			provenance: {
				...provenance,
				sfx: "game.json",
			},
			resources: [
				{
					id: "wrong-spawn",
					path: "image/wrong-spawn.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
					path: [
						"sfx",
						"events",
						"job:started",
					],
					resourceId: "missing-job-start",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "sfx",
					resourceId: "wrong-spawn",
					source: "game.json",
				}),
			]),
		);
	});

	it("requires every presentation-event assignment to resolve to SFX", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			sfx: {
				events: {
					"item-detail:opened": "missing-detail-open",
					"item-detail:closed": "wrong-detail-close",
				},
			},
		});
		const diagnostics = validateGameResourcesFn({
			config,
			provenance: {
				...provenance,
				sfx: "game.json",
			},
			resources: [
				{
					id: "wrong-detail-close",
					path: "image/wrong-detail-close.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
					path: [
						"sfx",
						"events",
						"item-detail:opened",
					],
					resourceId: "missing-detail-open",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "sfx",
					resourceId: "wrong-detail-close",
					source: "game.json",
				}),
			]),
		);
	});

	it("reports duplicate and missing exact resource IDs", () => {
		const diagnostics = validateGameResourcesFn({
			config: startTestConfig,
			provenance,
			resources: [
				{
					id: "hero",
					path: "a/hero.png",
					type: "image",
				},
				{
					id: "hero",
					path: "b/hero.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceDuplicate,
					resourceId: "hero",
				}),
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
				}),
			]),
		);
	});

	it("reports the exact missing default layer entries", () => {
		const [itemId, item] = Object.entries(startTestConfig.items)[0] ?? [];
		if (itemId === undefined || item === undefined) throw new Error("Missing test item.");
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemId]: {
					...item,
					artwork: {
						scale: 0.8,
						default: [
							"missing:base",
							"missing:overlay",
						],
					},
				},
			},
		});
		const diagnostics = validateGameResourcesFn({
			config,
			provenance,
			resources: [],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					resourceId: "missing:base",
					path: [
						"items",
						itemId,
						"artwork",
						"default",
						0,
					],
				}),
				expect.objectContaining({
					resourceId: "missing:overlay",
					path: [
						"items",
						itemId,
						"artwork",
						"default",
						1,
					],
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
			uid: id,
			id,
			maxQueueSize: 1,

			units: {
				amount: 1,
			},
			title: id,
			description: id,
			artwork: {
				scale: 0.8,
				default: [
					"blueprint",
					targetAsset,
				] as const,
			},
			scope: "any" as const,
			maxStackSize: 1,
			lines: [
				{
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
								rules: [],
								roll: [
									{
										type: "guaranteed" as const,
										drop: [
											{
												itemId: targetId,
												quantity: {
													min: 1,
													max: 1,
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
			],
		});
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				"blueprint:tree": blueprintItem({
					id: "blueprint:tree",
					targetId: "tree",
					targetAsset: "artwork:tree",
				}),
				"blueprint:log": blueprintItem({
					id: "blueprint:log",
					targetId: "log",
					targetAsset: "artwork:log",
				}),
			},
		});
		const diagnostics = validateGameResourcesFn({
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
				"artwork:tree",
				"artwork:log",
				"artwork:lens",
				"artwork:backpack",
				"blueprint",
			].map((id) => ({
				id,
				path: `${id}.png`,
				type: readResourceTypeFn(id),
			})),
		});

		expect(diagnostics).toEqual([]);
	});
});
