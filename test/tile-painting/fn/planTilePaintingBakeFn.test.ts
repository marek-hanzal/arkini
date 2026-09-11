import { describe, expect, it } from "vitest";
import { planTilePaintingBakeFn } from "~/tile-painting/fn/planTilePaintingBakeFn";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

const documentFn = (sourceResourceId: string): TilePaintingDocumentSchema.Type => ({
	name: sourceResourceId,
	images: [
		{
			id: "image",
			label: sourceResourceId,
			sourceResourceId,
		},
	],
	layers: [
		{
			id: "layer",
			name: "Layer",
			imageId: "image",
			visible: true,
			opacity: 1,
			tileSize: 256,
			strokes: [],
		},
	],
	catalog: [],
	scatter: [],
	reference: null,
	preview: {
		rows: 1,
		columns: 1,
		cells: [
			{
				kind: "painting",
			},
		],
	},
});
const paintingFn = (
	paintingId: string,
	sourceResourceId: string,
): planTilePaintingBakeFn.Painting => ({
	paintingId,
	outputResourceId: paintingId,
	document: documentFn(sourceResourceId),
});

describe("planTilePaintingBakeFn", () => {
	it("orders a root-to-child render chain independently of listing order and ignores mutual preview/reference guides", () => {
		const root = paintingFn("root", "texture");
		const child = paintingFn("child", "root");
		const withGuideFn = (
			painting: planTilePaintingBakeFn.Painting,
			sourceResourceId: string,
		): planTilePaintingBakeFn.Painting => ({
			...painting,
			document: {
				...painting.document,
				images: [
					...painting.document.images,
					{
						id: "guide",
						label: "Guide",
						sourceResourceId,
					},
				],
				reference: {
					imageId: "guide",
					opacity: 1,
					visible: true,
				},
				preview: {
					rows: 1,
					columns: 1,
					cells: [
						{
							kind: "image",
							imageId: "guide",
						},
					],
				},
			},
		});
		const result = planTilePaintingBakeFn({
			paintings: [
				withGuideFn(child, "child"),
				withGuideFn(root, "child"),
				{
					paintingId: "unbaked",
					outputResourceId: null,
					document: documentFn("missing"),
				},
			],
			resourceIds: [
				"texture",
			],
		});
		expect(result.type).toBe("ready");
		if (result.type !== "ready") return;
		expect(result.steps.map((step) => step.paintingId)).toEqual([
			"root",
			"child",
		]);
		expect(result.skippedCount).toBe(1);
	});

	it("rejects render cycles even when old output resources exist", () => {
		expect(
			planTilePaintingBakeFn({
				paintings: [
					paintingFn("a", "b"),
					paintingFn("b", "a"),
				],
				resourceIds: [
					"a",
					"b",
				],
			}),
		).toMatchObject({
			type: "invalid",
			reason: "cycle",
		});
	});

	it.each([
		"brush",
		"scatter",
	])("treats a placed %s source as an output dependency", (kind) => {
		const painting = paintingFn("output", "texture");
		const image = {
			id: "self",
			label: "Self",
			sourceResourceId: "output",
		};
		const document = {
			...painting.document,
			images: [
				...painting.document.images,
				image,
			],
		};
		if (kind === "brush")
			document.layers[0].strokes = [
				{
					mode: "hide",
					size: 50,
					opacity: 1,
					hardness: 1,
					shape: "image",
					brushImageId: "self",
					points: [
						{
							x: 100,
							y: 100,
						},
					],
				},
			];
		else
			document.scatter = [
				{
					stamps: [
						{
							imageId: "self",
							x: 100,
							y: 100,
							size: 50,
						},
					],
				},
			];
		expect(
			planTilePaintingBakeFn({
				paintings: [
					{
						...painting,
						document,
					},
				],
				resourceIds: [
					"texture",
					"output",
				],
			}),
		).toMatchObject({
			type: "invalid",
			reason: "cycle",
		});
	});

	it("rejects duplicate owners and genuinely missing referenced sources before rendering", () => {
		expect(
			planTilePaintingBakeFn({
				paintings: [
					paintingFn("same", "texture"),
					{
						...paintingFn("other", "texture"),
						outputResourceId: "same",
					},
				],
				resourceIds: [
					"texture",
				],
			}),
		).toMatchObject({
			type: "invalid",
			reason: "duplicate-output",
		});
		expect(
			planTilePaintingBakeFn({
				paintings: [
					paintingFn("one", "missing"),
				],
				resourceIds: [],
			}),
		).toMatchObject({
			type: "invalid",
			reason: "missing-source",
		});
	});

	it("does not block a build on a deleted image left only in the unused image registry", () => {
		const painting = paintingFn("output", "texture");
		painting.document.images.push({
			id: "unused",
			label: "Unused",
			sourceResourceId: "deleted",
		});
		expect(
			planTilePaintingBakeFn({
				paintings: [
					painting,
				],
				resourceIds: [
					"texture",
				],
			}).type,
		).toBe("ready");
	});
});
