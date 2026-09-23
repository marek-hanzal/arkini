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
		const [itemUid, item] = Object.entries(startTestConfig.items)[0]!;
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemUid]: {
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
									uid: "line-art",
									path: `${type}/line-art.png`,
									type,
								},
							],
			}).filter(
				(diagnostic) =>
					"resourceUid" in diagnostic && diagnostic.resourceUid === "line-art",
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
							itemUid,
							"lines",
							0,
							"artwork",
						],
						source: `${itemUid}.json`,
					}),
				]);
		}
	});

	it("validates item detail music against Music sources with item provenance", () => {
		const [itemUid, item] = Object.entries(startTestConfig.items)[0]!;
		const config = {
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemUid]: {
					...item,
					music: "detail-track",
				},
			},
		};
		for (const resources of [
			[],
			[
				{
					uid: "detail-track",
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
					resourceUid: "detail-track",
					path: [
						"items",
						itemUid,
						"music",
					],
					source: `${itemUid}.json`,
				}),
			);
		}
		expect(
			validateGameResourcesFn({
				config,
				provenance,
				resources: [
					{
						uid: "detail-track",
						path: "music/detail-track.ogg",
						type: "music",
					},
				],
			}).filter(
				(diagnostic) =>
					"resourceUid" in diagnostic && diagnostic.resourceUid === "detail-track",
			),
		).toEqual([]);
	});

	it("accepts exact resource UIDs", () => {
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
				uid: id,
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
					uid: "hero",
					path: "hero.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
				resourceUid: "avatar-02",
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
					].includes(diagnostic.resourceUid),
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
					uid: "wrong-theme",
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
					resourceUid: "missing-theme",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "music",
					resourceUid: "wrong-theme",
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
					uid: "wrong-spawn",
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
					resourceUid: "missing-job-start",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "sfx",
					resourceUid: "wrong-spawn",
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
					uid: "wrong-detail-close",
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
					resourceUid: "missing-detail-open",
					source: "game.json",
				}),
				expect.objectContaining({
					actualType: "image",
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					expectedType: "sfx",
					resourceUid: "wrong-detail-close",
					source: "game.json",
				}),
			]),
		);
	});

	it("reports duplicate and missing exact resource UIDs", () => {
		const diagnostics = validateGameResourcesFn({
			config: startTestConfig,
			provenance,
			resources: [
				{
					uid: "hero",
					path: "a/hero.png",
					type: "image",
				},
				{
					uid: "hero",
					path: "b/hero.png",
					type: "image",
				},
			],
		});

		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceDuplicate,
					resourceUid: "hero",
				}),
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
				}),
			]),
		);
	});

	it("reports the exact missing default layer entries", () => {
		const [itemUid, item] = Object.entries(startTestConfig.items)[0] ?? [];
		if (itemUid === undefined || item === undefined) throw new Error("Missing test item.");
		const config = GameConfigSchema.parse({
			...startTestConfig,
			items: {
				...startTestConfig.items,
				[itemUid]: {
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
					resourceUid: "missing:base",
					path: [
						"items",
						itemUid,
						"artwork",
						"default",
						0,
					],
				}),
				expect.objectContaining({
					resourceUid: "missing:overlay",
					path: [
						"items",
						itemUid,
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
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed" as const,
										outcome: [
											{
												type: "item",
												itemUid: targetId,
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
				"blueprint",
			].map((id) => ({
				uid: id,
				path: `${id}.png`,
				type: readResourceTypeFn(id),
			})),
		});

		expect(diagnostics).toEqual([]);
	});
});
