import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { createTilePaintingScatterStampsFx } from "~/tile-painting/fx/createTilePaintingScatterStampsFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

const catalog: TilePaintingDocumentSchema.Type["catalog"] = [
	{
		id: "grass",
		imageId: "grass",
		weight: 1,
		minSize: 10,
		maxSize: 20,
		enabled: true,
	},
	{
		id: "flower",
		imageId: "flower",
		weight: 3,
		minSize: 30,
		maxSize: 50,
		enabled: true,
	},
];

const stampFn = (entries: typeof catalog, roll: number) =>
	Effect.runSync(
		createTilePaintingScatterStampsFx(
			entries,
			[
				{
					x: 10,
					y: 20,
				},
			],
			0,
		).pipe(
			Effect.provideServiceEffect(
				Random.Random,
				makeFixedRandomFx([
					roll,
					0,
					0,
					0.5,
				]),
			),
		),
	);

describe("weighted scattering", () => {
	it("uses relative weight intervals and the chosen decoration's size range", () => {
		expect(
			[
				0,
				0.249,
				0.25,
				0.5,
				0.999,
			].map((roll) => stampFn(catalog, roll)[0].imageId),
		).toEqual([
			"grass",
			"grass",
			"flower",
			"flower",
			"flower",
		]);
		expect(stampFn(catalog, 0.5)[0]).toEqual({
			imageId: "flower",
			x: 10,
			y: 20,
			size: 40,
		});
		expect(
			stampFn(
				catalog.map((entry) => ({
					...entry,
					weight: entry.weight * 100,
				})),
				0.25,
			),
		).toEqual(stampFn(catalog, 0.25));
	});

	it("excludes disabled and zero-weight entries, including at random zero", () => {
		const entries = [
			{
				...catalog[0],
				weight: 0,
			},
			{
				...catalog[0],
				id: "disabled",
				enabled: false,
				weight: 100,
			},
			catalog[1],
		];
		expect(stampFn(entries, 0)[0].imageId).toBe("flower");
		expect(stampFn(entries.slice(0, 2), 0)).toEqual([]);
	});

	it("keeps resolved placements independent from later catalog edits", () => {
		const entries = catalog.map((entry) => ({
			...entry,
		}));
		const stamps = stampFn(entries, 0.5);
		entries[1].weight = 0;
		entries[1].maxSize = 300;
		expect(stamps).toEqual([
			{
				imageId: "flower",
				x: 10,
				y: 20,
				size: 40,
			},
		]);
		expect(stampFn(entries, 0.5)[0].imageId).toBe("grass");
	});
});
