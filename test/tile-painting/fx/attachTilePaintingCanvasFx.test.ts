// @vitest-environment jsdom
import { Effect, Exit, Scope } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTilePaintingCanvasFx } from "~/tile-painting/fx/attachTilePaintingCanvasFx";
import { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

const renders = vi.hoisted(() => vi.fn());
const decoders = vi.hoisted(() => vi.fn());
vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	return {
		RendererRuntime: {
			runSync: Effect.runSync,
			runPromise: Effect.runPromise,
		},
	};
});
vi.mock("~/tile-painting/fx/createTilePaintingRendererFx", () => ({
	createTilePaintingRendererFx: (...args: unknown[]) => decoders(...args),
}));

let scope: Scope.Closeable;
let session: makeTilePaintingSessionFx.Output;
let owner: attachTilePaintingCanvasFx.Output;
let surface: HTMLDivElement;
let canvas: HTMLCanvasElement;
let cursor: HTMLDivElement;
let loading: HTMLDivElement;
const changes = vi.fn();
const painting: TilePaintingDocumentSchema.Type = {
	name: "Ground",
	images: [
		{
			id: "dirt",
			label: "Dirt",
			sourceResourceId: "item-water",
		},
	],
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
	catalog: [
		{
			id: "flowers",
			imageId: "dirt",
			weight: 1,
			minSize: 12,
			maxSize: 20,
			enabled: true,
		},
	],
	scatter: [],
	preview: {
		columns: 3,
		rows: 3,
		cells: Array.from(
			{
				length: 9,
			},
			() => ({
				kind: "painting" as const,
			}),
		),
	},
	reference: null,
};

const pointerFn = (type: string, x = 320, y = 240, button = 0) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		clientX: x,
		clientY: y,
		button,
	});
	Object.defineProperty(event, "pointerId", {
		value: 1,
	});
	surface.dispatchEvent(event);
};
const mountFn = async () => {
	scope = Effect.runSync(Scope.make());
	owner = Effect.runSync(
		attachTilePaintingCanvasFx({
			resources: [],
			session,
			viewportElement: surface,
			canvas,
			cursorElement: cursor,
			loadingElement: loading,
		}).pipe(Effect.provideService(Scope.Scope, scope)),
	);
	await Promise.resolve();
};
beforeEach(async () => {
	vi.useFakeTimers();
	decoders.mockReset();
	decoders.mockImplementation(() =>
		Effect.succeed({
			renderFx: (request: unknown) => {
				renders(request);
				return Effect.void;
			},
		}),
	);
	renders.mockClear();
	changes.mockClear();
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			disconnect() {}
		},
	);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		x: 0,
		y: 0,
		left: 0,
		top: 0,
		right: 640,
		bottom: 480,
		width: 640,
		height: 480,
		toJSON: () => ({}),
	});
	Object.defineProperties(HTMLElement.prototype, {
		setPointerCapture: {
			configurable: true,
			value: () => {},
		},
		releasePointerCapture: {
			configurable: true,
			value: () => {},
		},
		hasPointerCapture: {
			configurable: true,
			value: () => false,
		},
	});
	session = Effect.runSync(
		makeTilePaintingSessionFx({
			loaded: {
				paintingId: "painting",
				projectId: "project",
				updatedAtMs: 1,
				outputResourceId: null,
				document: painting,
			},
			project: {
				projectId: "project",
				title: "Test",
				version: {
					major: 1,
					minor: 0,
				},
				createdAtMs: 1,
				updatedAtMs: 1,
				revision: 1,
				config: editorTestConfig,
				resources: [],
			},
		}),
	);
	Effect.runSync(
		session.setBrushFx({
			size: 32,
			opacity: 1,
			hardness: 1,
			shape: "circle",
			brushImageId: null,
		}),
	);
	Effect.runSync(session.setScatterSpacingFx(10));
	let previous = session.readFn().document;
	session.subscribeFn(() => {
		const next = session.readFn().document;
		if (next !== previous) {
			previous = next;
			changes(next);
		}
	});
	surface = document.createElement("div");
	canvas = document.createElement("canvas");
	cursor = document.createElement("div");
	loading = document.createElement("div");
	surface.append(canvas, cursor, loading);
	document.body.append(surface);
	await mountFn();
});
afterEach(() => {
	Effect.runSync(Scope.close(scope, Exit.void));
	Effect.runSync(session.closeFx);
	document.body.replaceChildren();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("native painting gesture settlement", () => {
	it.each([
		"reveal",
		"scatter",
	] as const)("commits consecutive %s clicks synchronously without a React turn", (tool) => {
		Effect.runSync(session.setToolFx(tool));
		for (let index = 0; index < 50; index++) {
			pointerFn("pointerdown", 300 + (index % 5) * 20);
			pointerFn("pointerup", 300 + (index % 5) * 20);
		}
		const committed = session.readFn().document;
		expect(tool === "scatter" ? committed.scatter : committed.layers[0].strokes).toHaveLength(
			50,
		);
		expect(changes).toHaveBeenCalledTimes(50);
		Effect.runSync(session.undoFx);
		expect(
			tool === "scatter"
				? session.readFn().document.scatter
				: session.readFn().document.layers[0].strokes,
		).toHaveLength(49);
		Effect.runSync(session.redoFx);
		expect(session.readFn().document).toBe(committed);
	});
	it("recovers from failed brush decoding when Circle removes the broken source dependency", async () => {
		const unused = {
			id: "broken",
			label: "Broken",
			sourceResourceId: "broken-asset",
		};
		Effect.runSync(
			session.editFx({
				...painting,
				images: [
					...painting.images,
					unused,
				],
			}),
		);
		await vi.advanceTimersByTimeAsync(0);
		decoders.mockImplementationOnce(() => Effect.fail(new Error("Broken brush")));
		Effect.runSync(
			session.setBrushFx({
				...session.readFn().brush,
				shape: "image",
				brushImageId: "broken",
			}),
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(session.readFn().error).toBe("Broken brush");
		Effect.runSync(
			session.setBrushFx({
				...session.readFn().brush,
				shape: "circle",
			}),
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(decoders.mock.lastCall?.[0]).toEqual(painting.images);
		expect(session.readFn().error).toBeNull();
		pointerFn("pointerdown");
		pointerFn("pointerup");
		expect(session.readFn().document.layers[0].strokes).toHaveLength(1);
	});

	it("resolves only used Assets and admits a retained brush when it becomes active", async () => {
		const unused = {
			id: "unused",
			label: "Unused",
			sourceResourceId: "unused-asset",
		};
		Effect.runSync(
			session.editFx({
				...painting,
				images: [
					...painting.images,
					unused,
				],
			}),
		);
		Effect.runSync(
			owner.setResourcesFx([
				{
					id: "unused-asset",
					mime: "image/png",
					bytes: new Uint8Array(),
				},
			]),
		);
		await Promise.resolve();
		expect(decoders.mock.lastCall?.[0]).toEqual(painting.images);
		const count = decoders.mock.calls.length;
		Effect.runSync(
			session.setBrushFx({
				...session.readFn().brush,
				shape: "image",
				brushImageId: "unused",
			}),
		);
		await Promise.resolve();
		expect(decoders.mock.calls.length).toBe(count + 1);
		expect(decoders.mock.lastCall?.[0]).toEqual([
			...painting.images,
			unused,
		]);
	});

	it("keeps the next stroke active after the preceding commit", () => {
		pointerFn("pointerdown", 300);
		pointerFn("pointerup", 300);
		pointerFn("pointerdown", 340);
		pointerFn("pointermove", 360);
		pointerFn("pointerup", 380);
		expect(session.readFn().document.layers[0].strokes).toHaveLength(2);
		expect(session.readFn().document.layers[0].strokes[1].points.length).toBeGreaterThan(1);
	});
	it("updates the cursor without session publications or painting renders", async () => {
		await vi.advanceTimersByTimeAsync(250);
		renders.mockClear();
		const listener = vi.fn();
		const stopFn = session.subscribeFn(listener);
		pointerFn("pointermove", 340, 250);
		pointerFn("pointermove", 360, 260);
		await vi.advanceTimersByTimeAsync(500);
		expect(renders).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
		expect(cursor.style.visibility).toBe("visible");
		stopFn();
	});
	it("defers shadows through gestures and settles after the last release", async () => {
		await vi.advanceTimersByTimeAsync(250);
		renders.mockClear();
		pointerFn("pointerdown");
		pointerFn("pointermove", 360);
		await vi.advanceTimersByTimeAsync(500);
		expect(renders).toHaveBeenCalled();
		expect(renders.mock.calls.every(([request]) => request.deferShadows)).toBe(true);
		pointerFn("pointerup", 380);
		await vi.advanceTimersByTimeAsync(80);
		pointerFn("pointerdown");
		await vi.advanceTimersByTimeAsync(500);
		expect(renders.mock.calls.every(([request]) => request.deferShadows)).toBe(true);
		pointerFn("pointerup", 400);
		await vi.advanceTimersByTimeAsync(220);
		expect(renders.mock.calls.at(-1)?.[0].deferShadows).toBe(false);
		expect(renders.mock.calls.at(-1)?.[0].pending).toBeUndefined();
	});
	it("detaches input and timers, then reattaches the retained draft and view", async () => {
		pointerFn("pointerdown");
		pointerFn("pointerup");
		Effect.runSync(
			session.setViewFx({
				zoom: 2,
				panX: 12,
				panY: 24,
			}),
		);
		const before = session.readFn();
		Effect.runSync(Scope.close(scope, Exit.void));
		renders.mockClear();
		pointerFn("pointerdown");
		pointerFn("pointerup");
		await vi.advanceTimersByTimeAsync(500);
		expect(renders).not.toHaveBeenCalled();
		expect(session.readFn()).toBe(before);
		await mountFn();
		await vi.advanceTimersByTimeAsync(30);
		expect(renders.mock.calls.at(-1)?.[0].document).toBe(before.document);
		pointerFn("pointerdown");
		pointerFn("pointerup");
		expect(session.readFn().document.layers[0].strokes).toHaveLength(2);
	});
	it("ignores a superseded decoder after a different image set is already ready", async () => {
		let resolveOldFn!: (renderer: { readonly renderFx: () => Effect.Effect<void> }) => void;
		const staleRenderFn = vi.fn(() => Effect.void);
		const pending = new Promise<{
			readonly renderFx: () => Effect.Effect<void>;
		}>((resolve) => {
			resolveOldFn = resolve;
		});
		decoders.mockImplementationOnce(() =>
			Effect.uninterruptible(Effect.promise(() => pending)),
		);
		Effect.runSync(
			session.editFx({
				...painting,
				images: [
					...painting.images,
				],
			}),
		);
		expect(loading.style.display).toBe("");
		const latest = {
			...painting,
			images: [
				...painting.images,
			],
			name: "Latest",
		};
		Effect.runSync(session.editFx(latest));
		await vi.advanceTimersByTimeAsync(30);
		expect(loading.style.display).toBe("none");
		resolveOldFn({
			renderFx: staleRenderFn,
		});
		await vi.advanceTimersByTimeAsync(250);
		pointerFn("pointerdown");
		pointerFn("pointerup");
		await vi.advanceTimersByTimeAsync(30);
		expect(staleRenderFn).not.toHaveBeenCalled();
		expect(renders.mock.calls.at(-1)?.[0].document).toBe(session.readFn().document);
		expect(session.readFn().document.layers[0].strokes).toHaveLength(1);
	});

	it("commits interpolated dabs once without modifying the source image or existing masks", () => {
		pointerFn("pointerdown");
		pointerFn("pointermove", 360);
		expect(changes).not.toHaveBeenCalled();
		pointerFn("pointerup", 400);
		expect(changes).toHaveBeenCalledOnce();
		const result = session.readFn().document;
		expect(result.layers[0].strokes[0].points.length).toBeGreaterThan(2);
		expect(result.images).toBe(painting.images);
		expect(painting.layers[0].strokes).toEqual([]);
	});
	it("snapshots all layer targets including hidden layers for one undo step", () => {
		const multi = {
			...painting,
			layers: [
				...painting.layers,
				{
					...painting.layers[0],
					id: "hidden",
					visible: false,
				},
			],
		};
		Effect.runSync(session.editFx(multi));
		Effect.runSync(session.setPaintAllLayersFx(true));
		changes.mockClear();
		pointerFn("pointerdown");
		Effect.runSync(session.setPaintAllLayersFx(false));
		pointerFn("pointermove", 360);
		pointerFn("pointerup");
		expect(changes).toHaveBeenCalledOnce();
		const result = session.readFn().document;
		expect(result.layers.map((layer) => layer.strokes.length)).toEqual([
			1,
			1,
		]);
		expect(result.layers[0].strokes[0]).toBe(result.layers[1].strokes[0]);
		Effect.runSync(session.undoFx);
		expect(session.readFn().document).toBe(multi);
	});
	it("keeps active-only painting isolated from other layers", () => {
		const other = {
			...painting.layers[0],
			id: "other",
		};
		Effect.runSync(
			session.editFx({
				...painting,
				layers: [
					...painting.layers,
					other,
				],
			}),
		);
		pointerFn("pointerdown");
		pointerFn("pointerup");
		expect(session.readFn().document.layers[0].strokes).toHaveLength(1);
		expect(session.readFn().document.layers[1]).toBe(other);
	});
	it("does not commit an all-layer gesture with an empty stack", () => {
		Effect.runSync(
			session.editFx({
				...painting,
				layers: [],
			}),
		);
		Effect.runSync(session.setPaintAllLayersFx(true));
		changes.mockClear();
		pointerFn("pointerdown");
		pointerFn("pointerup");
		expect(changes).not.toHaveBeenCalled();
	});
	it.each([
		"escape",
		"blur",
		"pointercancel",
		"lostpointercapture",
		"document-replaced",
		"suspended",
	])("discards a pending gesture on %s", (reason) => {
		pointerFn("pointerdown");
		pointerFn("pointermove", 370);
		if (reason === "escape")
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
				}),
			);
		else if (reason === "blur") window.dispatchEvent(new Event("blur"));
		else if (reason === "document-replaced")
			Effect.runSync(
				session.editFx({
					...painting,
					name: "Another revision",
				}),
			);
		else if (reason === "suspended") Effect.runSync(owner.setSuspendedFx(true));
		else pointerFn(reason);
		changes.mockClear();
		pointerFn("pointerup");
		expect(changes).not.toHaveBeenCalled();
		expect(session.readFn().document.layers[0].strokes).toHaveLength(0);
	});
	it("rejects a brush image removed through undo", () => {
		Effect.runSync(
			session.setBrushFx({
				...session.readFn().brush,
				shape: "image",
				brushImageId: "undone-image",
			}),
		);
		pointerFn("pointerdown");
		pointerFn("pointerup");
		expect(changes).not.toHaveBeenCalled();
		expect(session.readFn().error).toBe("Choose an image for the brush shape.");
	});
	it("rejects a scatter palette containing only zero weights", () => {
		Effect.runSync(
			session.editFx({
				...painting,
				catalog: painting.catalog.map((entry) => ({
					...entry,
					weight: 0,
				})),
			}),
		);
		Effect.runSync(session.setToolFx("scatter"));
		changes.mockClear();
		pointerFn("pointerdown");
		pointerFn("pointermove", 380);
		pointerFn("pointerup", 400);
		expect(changes).not.toHaveBeenCalled();
		expect(session.readFn().error).toBe(
			"Enable at least one scattering image with a positive weight.",
		);
	});
	it("preserves exact scattered placements through undo and redo", () => {
		Effect.runSync(session.setToolFx("scatter"));
		pointerFn("pointerdown");
		pointerFn("pointermove", 380);
		pointerFn("pointerup", 400);
		expect(changes).toHaveBeenCalledOnce();
		const result = session.readFn().document;
		expect(result.scatter).toHaveLength(1);
		expect(result.scatter[0].stamps.length).toBeGreaterThan(1);
		for (const stamp of result.scatter[0].stamps) {
			expect(stamp.imageId).toBe("dirt");
			expect(stamp.size).toBeGreaterThanOrEqual(12);
			expect(stamp.size).toBeLessThanOrEqual(20);
		}
		Effect.runSync(session.undoFx);
		Effect.runSync(session.redoFx);
		expect(session.readFn().document.scatter).toBe(result.scatter);
		expect(painting.scatter).toEqual([]);
	});
	it("uses the latest native view for back-to-back zoom events without painting changes", () => {
		const ui = session.readSessionFn();
		const before = Number.parseFloat(canvas.style.width);
		for (let i = 0; i < 3; i++)
			surface.dispatchEvent(
				new WheelEvent("wheel", {
					clientX: 320,
					clientY: 240,
					deltaY: -100,
					cancelable: true,
				}),
			);
		expect(session.readFn().view.zoom).toBeCloseTo(Math.exp(0.45));
		expect(Number.parseFloat(canvas.style.width)).toBeGreaterThan(before);
		expect(session.readSessionFn()).toBe(ui);
		expect(changes).not.toHaveBeenCalled();
	});
});
