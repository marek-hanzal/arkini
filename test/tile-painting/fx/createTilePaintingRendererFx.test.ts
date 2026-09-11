import { renderTilePaintingPngFx } from "~/tile-painting/fx/renderTilePaintingPngFx";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";
// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTilePaintingRendererFx } from "~/tile-painting/fx/createTilePaintingRendererFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

const painting: TilePaintingDocumentSchema.Type = {
	name: "Ground",
	images: [],
	layers: [
		{
			id: "ground",
			imageId: "dirt",
			name: "Ground",
			visible: true,
			opacity: 1,
			tileSize: 64,
			strokes: [],
		},
	],
	catalog: [],
	scatter: [],
	preview: {
		columns: 1,
		rows: 1,
		cells: [
			{
				kind: "painting",
			},
		],
	},
	reference: null,
};
const strokeFn = (): TilePaintingDocumentSchema.Stroke => ({
	mode: "reveal",
	size: 8,
	opacity: 0.5,
	hardness: 1,
	shape: "square",
	brushImageId: null,
	points: [
		{
			x: 20,
			y: 20,
		},
	],
});
let dabCount = 0;
let shadowCount = 0;
let shadowDrawCount = 0;
const stampAlphas: number[] = [];
type Rect = readonly [
	number,
	number,
	number,
	number,
];
const clears: {
	canvas: HTMLCanvasElement;
	bounds: Rect;
}[] = [];
const blurred: Rect[] = [];
const sourceImage = {
	naturalWidth: 8,
	naturalHeight: 8,
	onload: null as (() => void) | null,
	onerror: null as (() => void) | null,
	set src(_value: string) {
		queueMicrotask(() => this.onload?.());
	},
};

beforeEach(() => {
	vi.stubGlobal("URL", {
		createObjectURL: vi.fn(() => "blob:test"),
		revokeObjectURL: vi.fn(),
	});
	dabCount = 0;
	shadowCount = 0;
	shadowDrawCount = 0;
	stampAlphas.length = 0;
	clears.length = 0;
	blurred.length = 0;
	vi.stubGlobal("Image", function () {
		return sourceImage;
	});
	const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
		this: HTMLCanvasElement,
	) {
		let context = contexts.get(this);
		if (context === undefined) {
			const canvas = this;
			let pathBounds: Rect | undefined;
			let clipped: Rect | undefined;
			const stack: {
				clipped: Rect | undefined;
				filter: string;
				alpha: number;
				operation: string;
			}[] = [];
			const projection = {
				createPattern: () => null,
				filter: "none",
				globalAlpha: 1,
				globalCompositeOperation: "source-over",
				clearRect: (x: number, y: number, width: number, height: number) =>
					clears.push({
						canvas,
						bounds: clipped ?? [
							x,
							y,
							width,
							height,
						],
					}),
				beginPath: () => {
					pathBounds = undefined;
				},
				rect: (x: number, y: number, width: number, height: number) => {
					pathBounds = [
						x,
						y,
						width,
						height,
					];
				},
				clip: () => {
					clipped = pathBounds;
				},
				fillRect: (_x: number, _y: number, width: number) => {
					if (width === 8) dabCount += 1;
				},
				drawImage: (source: unknown) => {
					if (projection.globalCompositeOperation === "source-atop") shadowDrawCount += 1;
					if (source === sourceImage) stampAlphas.push(projection.globalAlpha);
					if (projection.filter.startsWith("blur(")) {
						shadowCount += 1;
						blurred.push(
							clipped ?? [
								0,
								0,
								canvas.width,
								canvas.height,
							],
						);
					}
				},
				save: () => {
					stack.push({
						clipped,
						filter: projection.filter,
						alpha: projection.globalAlpha,
						operation: projection.globalCompositeOperation,
					});
				},
				restore: () => {
					const state = stack.pop();
					if (state === undefined) throw new Error("Unbalanced canvas state");
					clipped = state.clipped;
					projection.filter = state.filter;
					projection.globalAlpha = state.alpha;
					projection.globalCompositeOperation = state.operation;
				},
			};
			context = projection as unknown as CanvasRenderingContext2D;
			contexts.set(this, context);
		}
		return context;
	} as never);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("painting gesture projections", () => {
	it("retains the computed shadow through a gesture and commit until deferred settlement", async () => {
		const renderer = await Effect.runPromise(createTilePaintingRendererFx([], []));
		const canvas = document.createElement("canvas");
		Effect.runSync(
			renderer.renderFx({
				document: painting,
				canvas,
			}),
		);
		expect(shadowDrawCount).toBe(1);
		const stroke = {
			...strokeFn(),
			mode: "hide" as const,
		};
		const pending = {
			layerIds: [
				"ground",
			],
			stroke,
		};
		shadowDrawCount = 0;
		clears.length = 0;
		Effect.runSync(
			renderer.renderFx({
				document: painting,
				canvas,
				pending,
				deferShadows: true,
			}),
		);
		expect(shadowDrawCount).toBe(1);
		expect(shadowCount).toBe(1);
		expect(clears.find((entry) => entry.canvas === canvas)?.bounds[2]).toBeLessThan(32);
		clears.length = 0;
		stroke.points.push({
			x: 24,
			y: 20,
		});
		Effect.runSync(
			renderer.renderFx({
				document: painting,
				canvas,
				pending,
				deferShadows: true,
			}),
		);
		expect(clears.find((entry) => entry.canvas === canvas)?.bounds[2]).toBeLessThan(32);
		// Cancelling keeps the unchanged cached shadow without filtering it again.
		shadowDrawCount = 0;
		Effect.runSync(
			renderer.renderFx({
				document: painting,
				canvas,
				deferShadows: true,
			}),
		);
		expect(shadowDrawCount).toBe(1);
		expect(shadowCount).toBe(1);
		Effect.runSync(
			renderer.renderFx({
				document: painting,
				canvas,
				pending,
				deferShadows: true,
			}),
		);
		const committed = {
			...painting,
			layers: [
				{
					...painting.layers[0],
					strokes: [
						{
							...stroke,
							points: [
								...stroke.points,
							],
						},
					],
				},
			],
		};
		shadowDrawCount = 0;
		Effect.runSync(
			renderer.renderFx({
				document: committed,
				canvas,
				deferShadows: true,
			}),
		);
		expect(shadowDrawCount).toBe(1);
		expect(shadowCount).toBe(1);
		shadowDrawCount = 0;
		Effect.runSync(
			renderer.renderFx({
				document: committed,
				canvas,
			}),
		);
		expect(shadowDrawCount).toBe(1);
		expect(shadowCount).toBe(2);
	});

	it("decodes current Asset bytes for the same recipe and releases temporary URLs", async () => {
		const sources = [
			{
				id: "dirt",
				label: "Dirt",
				sourceResourceId: "dirt",
			},
		];
		const bytes = createTestPngBytes();
		const replacement = new Uint8Array([
			...bytes,
			0,
		]);
		await Effect.runPromise(
			createTilePaintingRendererFx(sources, [
				{
					id: "dirt",
					mime: "image/png",
					bytes,
				},
			]),
		);
		await Effect.runPromise(
			createTilePaintingRendererFx(sources, [
				{
					id: "dirt",
					mime: "image/png",
					bytes: replacement,
				},
			]),
		);
		const readBlobFn = (blob: Blob) =>
			new Promise<Uint8Array>((resolve) => {
				const reader = new FileReader();
				reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
				reader.readAsArrayBuffer(blob);
			});
		const blobs = vi.mocked(URL.createObjectURL).mock.calls.map(([blob]) => blob as Blob);
		expect(await readBlobFn(blobs[0])).toEqual(bytes);
		expect(await readBlobFn(blobs[1])).toEqual(replacement);
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
	});

	it("bakes visible terrain without requiring hidden layers or editor-only guide Assets", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
			"data:image/png;base64,result",
		);
		const document = {
			...painting,
			images: [
				{
					id: "dirt",
					label: "Dirt",
					sourceResourceId: "dirt",
				},
				{
					id: "later",
					label: "Later output",
					sourceResourceId: "later",
				},
			],
			layers: [
				painting.layers[0],
				{
					...painting.layers[0],
					id: "hidden",
					imageId: "later",
					visible: false,
				},
				{
					...painting.layers[0],
					id: "transparent",
					imageId: "later",
					opacity: 0,
				},
			],
			reference: {
				imageId: "later",
				opacity: 1,
				visible: true,
			},
		};
		expect(
			await Effect.runPromise(
				renderTilePaintingPngFx(document, [
					{
						id: "dirt",
						mime: "image/png",
						bytes: createTestPngBytes(),
					},
				]),
			),
		).toBe("data:image/png;base64,result");
		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
	});

	it("paints only appended dabs and adopts the completed mask including an unrendered final point", async () => {
		const renderer = await Effect.runPromise(createTilePaintingRendererFx([], []));
		const canvas = document.createElement("canvas");
		const stroke = strokeFn();
		const pending = {
			layerIds: [
				"ground",
			],
			stroke,
		};
		const renderFn = () =>
			Effect.runPromise(
				renderer.renderFx({
					document: painting,
					canvas,
					pending,
					deferShadows: true,
				}),
			);
		await renderFn();
		await renderFn();
		expect(dabCount).toBe(1);
		stroke.points.push({
			x: 24,
			y: 20,
		});
		await renderFn();
		expect(dabCount).toBe(2);
		stroke.points.push({
			x: 28,
			y: 20,
		});
		const committed = {
			...painting,
			layers: [
				{
					...painting.layers[0],
					strokes: [
						{
							...stroke,
							points: [
								...stroke.points,
							],
						},
					],
				},
			],
		};
		await Effect.runPromise(
			renderer.renderFx({
				document: committed,
				canvas,
				deferShadows: true,
			}),
		);
		expect(dabCount).toBe(3);
		expect(shadowCount).toBe(0);
		await Effect.runPromise(
			renderer.renderFx({
				document: committed,
				canvas,
			}),
		);
		expect(shadowCount).toBe(1);
		await Effect.runPromise(
			renderer.renderFx({
				document: committed,
				canvas,
			}),
		);
		expect(shadowCount).toBe(1);
		// Undo clears the adopted projection; redo replays the canonical stroke exactly once.
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
			}),
		);
		await Effect.runPromise(
			renderer.renderFx({
				document: committed,
				canvas,
			}),
		);
		expect(dabCount).toBe(6);
	});

	it("discards a cancelled draft even when the next gesture starts at the same point", async () => {
		const renderer = await Effect.runPromise(createTilePaintingRendererFx([], []));
		const canvas = document.createElement("canvas");
		const abandoned = strokeFn();
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
				pending: {
					layerIds: [
						"ground",
					],
					stroke: abandoned,
				},
				deferShadows: true,
			}),
		);
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
			}),
		);
		const replacement = {
			...strokeFn(),
			mode: "hide" as const,
		};
		replacement.points[0] = abandoned.points[0];
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
				pending: {
					layerIds: [
						"ground",
					],
					stroke: replacement,
				},
				deferShadows: true,
			}),
		);
		expect(dabCount).toBe(2);
		const committed = {
			...painting,
			layers: [
				{
					...painting.layers[0],
					strokes: [
						replacement,
					],
				},
			],
		};
		await Effect.runPromise(
			renderer.renderFx({
				document: committed,
				canvas,
			}),
		);
		expect(dabCount).toBe(2);
		expect(shadowCount).toBe(2);
	});
	it("rasterizes only new pending scatter stamps and applies preview opacity to their composite", async () => {
		const renderer = await Effect.runPromise(
			createTilePaintingRendererFx(
				[
					{
						id: "dirt",
						sourceResourceId: "dirt",
						label: "Dirt",
					},
				],
				[
					{
						id: "dirt",
						mime: "image/png",
						bytes: createTestPngBytes(),
					},
				],
			),
		);
		const canvas = document.createElement("canvas");
		const emptyPainting = {
			...painting,
			layers: [],
		};
		const scatter = {
			stamps: [
				{
					imageId: "dirt",
					x: 20,
					y: 20,
					size: 8,
				},
			],
		};
		const renderFn = () =>
			Effect.runPromise(
				renderer.renderFx({
					document: emptyPainting,
					canvas,
					previewOpacity: 0.5,
					pending: {
						layerIds: [],
						scatter,
					},
				}),
			);
		await renderFn();
		await renderFn();
		expect(stampAlphas).toEqual([
			1,
		]);
		scatter.stamps.push({
			imageId: "dirt",
			x: 22,
			y: 20,
			size: 8,
		});
		await renderFn();
		expect(stampAlphas).toEqual([
			1,
			1,
		]);
		await Effect.runPromise(
			renderer.renderFx({
				document: {
					...emptyPainting,
					scatter: [
						{
							stamps: [
								...scatter.stamps,
							],
						},
					],
				},
				canvas,
				previewOpacity: 0.5,
			}),
		);
		expect(stampAlphas).toEqual([
			1,
			1,
			1,
			1,
		]);
	});
	it("limits scene writes to new dabs, skips unchanged frames, and fully clears cancelled projections", async () => {
		const renderer = await Effect.runPromise(createTilePaintingRendererFx([], []));
		const canvas = document.createElement("canvas");
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
				deferShadows: true,
			}),
		);
		clears.length = 0;
		const stroke = strokeFn();
		const props = {
			document: painting,
			canvas,
			pending: {
				layerIds: [
					"ground",
				],
				stroke,
			},
			deferShadows: true,
		};
		await Effect.runPromise(renderer.renderFx(props));
		const first = clears.filter((entry) => entry.canvas === canvas);
		expect(first).toHaveLength(1);
		expect(first[0].bounds[2]).toBeLessThan(32);
		clears.length = 0;
		await Effect.runPromise(renderer.renderFx(props));
		expect(clears.filter((entry) => entry.canvas === canvas)).toHaveLength(0);
		stroke.points.push({
			x: 800,
			y: 20,
		});
		await Effect.runPromise(renderer.renderFx(props));
		const second = clears.filter((entry) => entry.canvas === canvas);
		expect(second).toHaveLength(1);
		expect(second[0].bounds[0]).toBeGreaterThan(780);
		expect(second[0].bounds[2]).toBeLessThan(32);
		clears.length = 0;
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
			}),
		);
		expect(clears.find((entry) => entry.canvas === canvas)?.bounds).toEqual([
			0,
			0,
			1254,
			1254,
		]);
	});

	it("accumulates separated committed strokes until the deferred shadow settles", async () => {
		const renderer = await Effect.runPromise(createTilePaintingRendererFx([], []));
		const canvas = document.createElement("canvas");
		await Effect.runPromise(
			renderer.renderFx({
				document: painting,
				canvas,
			}),
		);
		blurred.length = 0;
		const first = strokeFn();
		const second = {
			...strokeFn(),
			points: [
				{
					x: 800,
					y: 20,
				},
			],
		};
		const firstPainting = {
			...painting,
			layers: [
				{
					...painting.layers[0],
					strokes: [
						first,
					],
				},
			],
		};
		const secondPainting = {
			...painting,
			layers: [
				{
					...painting.layers[0],
					strokes: [
						first,
						second,
					],
				},
			],
		};
		await Effect.runPromise(
			renderer.renderFx({
				document: firstPainting,
				canvas,
				deferShadows: true,
			}),
		);
		await Effect.runPromise(
			renderer.renderFx({
				document: secondPainting,
				canvas,
				deferShadows: true,
			}),
		);
		expect(blurred).toHaveLength(0);
		await Effect.runPromise(
			renderer.renderFx({
				document: secondPainting,
				canvas,
			}),
		);
		expect(blurred).toHaveLength(1);
		expect(blurred[0][0]).toBeLessThan(20);
		expect(blurred[0][0] + blurred[0][2]).toBeGreaterThan(800);
		expect(blurred[0][2]).toBeLessThan(1254);
		expect(blurred[0][3]).toBeLessThan(1254);
		await Effect.runPromise(
			renderer.renderFx({
				document: secondPainting,
				canvas,
			}),
		);
		expect(blurred).toHaveLength(1);
	});
});
