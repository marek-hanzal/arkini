import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { readTilePaintingPngSupportFn } from "~/tile-painting/fn/readTilePaintingPngSupportFn";
import { TilePaintingDefaultShadow } from "~/tile-painting/constant/TilePaintingDefaultShadow";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { Effect } from "effect";
import { TilePaintingRenderError } from "~/tile-painting/error/TilePaintingRenderError";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace createTilePaintingRendererFx {
	/** A gesture keeps its stroke identity and only appends points/stamps; committed commands are immutable. */
	export interface Pending {
		readonly layerIds: ReadonlyArray<string>;
		readonly stroke?: TilePaintingDocumentSchema.Stroke;
		readonly scatter?: TilePaintingDocumentSchema.ScatterStroke;
	}

	export interface Output {
		readonly renderFx: (props: {
			readonly document: TilePaintingDocumentSchema.Type;
			readonly canvas: HTMLCanvasElement;
			readonly referenceOnly?: boolean;
			readonly previewOpacity?: number;
			readonly includeReference?: boolean;
			readonly pending?: Pending;
			readonly deferShadows?: boolean;
		}) => Effect.Effect<Frame>;
	}
	/** What reached the output surface, including cache decisions needed to diagnose lost projections. */
	export interface Frame {
		readonly changed:
			| "full"
			| "none"
			| {
					readonly left: number;
					readonly top: number;
					readonly right: number;
					readonly bottom: number;
			  };
		readonly adoptedLayerIds: ReadonlyArray<string>;
		readonly replayedLayerIds: ReadonlyArray<string>;
	}
}

interface Bounds {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}
type DirtyRegion = Bounds | "full" | undefined;

const unionRegionFn = (left: DirtyRegion, right: DirtyRegion): DirtyRegion => {
	if (left === "full" || right === "full") return "full";
	if (left === undefined) return right;
	if (right === undefined) return left;
	return {
		left: Math.min(left.left, right.left),
		top: Math.min(left.top, right.top),
		right: Math.max(left.right, right.right),
		bottom: Math.max(left.bottom, right.bottom),
	};
};

const expandBoundsFn = (bounds: Bounds, reach: number, offsetX = 0, offsetY = 0): Bounds => ({
	left: Math.max(0, Math.min(TilePaintingCanvasSize, Math.floor(bounds.left + offsetX - reach))),
	top: Math.max(0, Math.min(TilePaintingCanvasSize, Math.floor(bounds.top + offsetY - reach))),
	right: Math.max(0, Math.min(TilePaintingCanvasSize, Math.ceil(bounds.right + offsetX + reach))),
	bottom: Math.max(
		0,
		Math.min(TilePaintingCanvasSize, Math.ceil(bounds.bottom + offsetY + reach)),
	),
});

const readDabBoundsFn = (
	stroke: TilePaintingDocumentSchema.Stroke,
	start: number,
): Bounds | undefined => {
	const reach =
		stroke.size / 2 +
		2 +
		(stroke.mode === "smooth" ? Math.min(32, Math.max(0.5, stroke.size / 8)) * 3 : 0);
	let bounds: Bounds | undefined;
	for (let index = start; index < stroke.points.length; index += 1) {
		const point = stroke.points[index];
		const next = expandBoundsFn(
			{
				left: point.x,
				top: point.y,
				right: point.x,
				bottom: point.y,
			},
			reach,
		);
		bounds =
			bounds === undefined
				? next
				: {
						left: Math.min(bounds.left, next.left),
						top: Math.min(bounds.top, next.top),
						right: Math.max(bounds.right, next.right),
						bottom: Math.max(bounds.bottom, next.bottom),
					};
	}
	return bounds;
};

const readStampBoundsFn = (
	stamps: ReadonlyArray<TilePaintingDocumentSchema.Stamp>,
	start: number,
): DirtyRegion => {
	let bounds: DirtyRegion;
	for (let index = start; index < stamps.length; index += 1) {
		const stamp = stamps[index];
		bounds = unionRegionFn(
			bounds,
			expandBoundsFn(
				{
					left: stamp.x,
					top: stamp.y,
					right: stamp.x,
					bottom: stamp.y,
				},
				stamp.size / 2 + 2,
			),
		);
	}
	return bounds;
};

const readShadowBoundsFn = (
	layer: TilePaintingDocumentSchema.Layer,
	dirty: DirtyRegion,
): DirtyRegion => {
	const shadow = layer.shadow ?? TilePaintingDefaultShadow;
	if (dirty === undefined || dirty === "full") return dirty;
	return expandBoundsFn(dirty, Math.ceil(shadow.blur * 3) + 2, shadow.offsetX, shadow.offsetY);
};

const clipContextFx = (context: CanvasRenderingContext2D, bounds: Bounds) =>
	Effect.sync(() => {
		context.beginPath();
		context.rect(
			bounds.left,
			bounds.top,
			Math.max(0, bounds.right - bounds.left),
			Math.max(0, bounds.bottom - bounds.top),
		);
		context.clip();
	});

const createCanvasFx = (width: number, height: number) =>
	Effect.sync(() => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	});

const readContextFx = (canvas: HTMLCanvasElement) =>
	Effect.sync(() => {
		const context = canvas.getContext("2d");
		if (context === null) throw new Error("Canvas 2D is unavailable.");
		return context;
	});

const loadImageFx = (source: TilePaintingDocumentSchema.Image, url: string) =>
	Effect.callback<HTMLImageElement, TilePaintingRenderError>((resume) => {
		const image = new Image();
		image.onload = () => resume(Effect.succeed(image));
		image.onerror = () =>
			resume(
				Effect.fail(
					new TilePaintingRenderError({
						message: `Cannot decode painting image ${source.label}.`,
					}),
				),
			);
		image.src = url;
		return Effect.sync(() => {
			image.onload = null;
			image.onerror = null;
		});
	});

/** Masks and composites are disposable projections; the document's dab/stamp commands remain canonical. */
export const createTilePaintingRendererFx = Effect.fn("createTilePaintingRendererFx")(function* (
	sources: ReadonlyArray<TilePaintingDocumentSchema.Image>,
	resources: ReadonlyArray<ResourceSchema.Type>,
): Effect.fn.Return<createTilePaintingRendererFx.Output, TilePaintingRenderError> {
	const assets = new Map(
		resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	const decoded = yield* Effect.forEach(
		sources,
		(source) =>
			Effect.gen(function* () {
				const resource = assets.get(source.sourceResourceId);
				if (resource === undefined || !readTilePaintingPngSupportFn(resource.bytes))
					return yield* Effect.fail(
						new TilePaintingRenderError({
							message: `Source asset ${source.sourceResourceId} must exist as a single-frame PNG no larger than 2048 × 2048 pixels.`,
						}),
					);
				const image = yield* Effect.acquireUseRelease(
					Effect.sync(() =>
						URL.createObjectURL(
							new Blob(
								[
									resource.bytes.slice().buffer,
								],
								{
									type: resource.mime,
								},
							),
						),
					),
					(url) => loadImageFx(source, url),
					(url) => Effect.sync(() => URL.revokeObjectURL(url)),
				);
				return [
					source.id,
					image,
				] as const;
			}),
		{
			concurrency: 8,
		},
	);
	const images = new Map(decoded);
	const terrain = yield* createCanvasFx(TilePaintingCanvasSize, TilePaintingCanvasSize);
	let shadowImprint: HTMLCanvasElement | undefined;
	const layers = new Map<
		string,
		{
			layer: TilePaintingDocumentSchema.Layer;
			mask: HTMLCanvasElement;
			composite: HTMLCanvasElement;
			shadow?: HTMLCanvasElement;
			displayedShadow?: HTMLCanvasElement;
			shadowDirty: DirtyRegion;
		}
	>();
	const drafts = new Map<
		string,
		{
			source: TilePaintingDocumentSchema.Layer;
			mask: HTMLCanvasElement;
			composite: HTMLCanvasElement;
			shadow?: HTMLCanvasElement;
			stroke: TilePaintingDocumentSchema.Stroke;
			painted: number;
			shadowDirty: DirtyRegion;
		}
	>();
	let scatterDraft:
		| {
				stroke: TilePaintingDocumentSchema.ScatterStroke;
				canvas: HTMLCanvasElement;
				painted: number;
		  }
		| undefined;
	let smoothScratch:
		| {
				softened: HTMLCanvasElement;
				imprint: HTMLCanvasElement;
		  }
		| undefined;
	let scatterCache:
		| {
				strokes: TilePaintingDocumentSchema.Type["scatter"];
				canvas: HTMLCanvasElement;
		  }
		| undefined;

	let scene:
		| {
				painting: TilePaintingDocumentSchema.Type;
				canvas: HTMLCanvasElement;
				includeReference: boolean;
				previewOpacity: number;
				stroke?: TilePaintingDocumentSchema.Stroke;
				scatter?: TilePaintingDocumentSchema.ScatterStroke;
				layerIds: ReadonlyArray<string>;
		  }
		| undefined;

	const paintDabsFx = (
		mask: HTMLCanvasElement,
		stroke: TilePaintingDocumentSchema.Stroke,
		start: number,
	): Effect.Effect<void> =>
		Effect.gen(function* () {
			const context = yield* readContextFx(mask);
			if (stroke.mode === "smooth") {
				const blur = Math.min(32, Math.max(0.5, stroke.size / 8));
				const reach = stroke.size / 2 + blur * 3;
				for (let index = start; index < stroke.points.length; index += 1) {
					const point = stroke.points[index];
					const x = Math.max(0, Math.floor(point.x - reach));
					const y = Math.max(0, Math.floor(point.y - reach));
					const width = Math.min(mask.width, Math.ceil(point.x + reach)) - x;
					const height = Math.min(mask.height, Math.ceil(point.y + reach)) - y;
					if (width <= 0 || height <= 0) continue;
					if (smoothScratch === undefined) {
						smoothScratch = {
							softened: yield* createCanvasFx(width, height),
							imprint: yield* createCanvasFx(width, height),
						};
					}
					const { softened, imprint } = smoothScratch;
					for (const scratch of [
						softened,
						imprint,
					]) {
						if (scratch.width !== width) scratch.width = width;
						if (scratch.height !== height) scratch.height = height;
						const scratchContext = yield* readContextFx(scratch);
						scratchContext.globalCompositeOperation = "source-over";
						scratchContext.clearRect(0, 0, width, height);
					}
					const softenedContext = yield* readContextFx(softened);
					softenedContext.filter = `blur(${blur}px)`;
					softenedContext.drawImage(mask, x, y, width, height, 0, 0, width, height);
					softenedContext.filter = "none";
					yield* paintDabsFx(
						imprint,
						{
							...stroke,
							mode: "reveal",
							points: [
								{
									x: point.x - x,
									y: point.y - y,
								},
							],
						},
						0,
					);
					softenedContext.globalCompositeOperation = "destination-in";
					softenedContext.drawImage(imprint, 0, 0);
					context.save();
					// Interpolate neighboring alpha: original * (1 - brush) + blurred * brush.
					// Additive composition is required: source-over would bias the blend toward opacity.
					context.globalCompositeOperation = "destination-out";
					context.drawImage(imprint, x, y);
					context.globalCompositeOperation = "lighter";
					context.drawImage(softened, x, y);
					context.restore();
				}
				return;
			}
			context.save();
			context.globalCompositeOperation =
				stroke.mode === "reveal" ? "source-over" : "destination-out";
			context.globalAlpha = stroke.opacity;
			const radius = stroke.size / 2;
			for (let index = start; index < stroke.points.length; index += 1) {
				const point = stroke.points[index];
				if (stroke.shape === "image") {
					const image =
						stroke.brushImageId === null ? undefined : images.get(stroke.brushImageId);
					if (image !== undefined) {
						const ratio =
							stroke.size / Math.max(image.naturalWidth, image.naturalHeight);
						context.drawImage(
							image,
							point.x - (image.naturalWidth * ratio) / 2,
							point.y - (image.naturalHeight * ratio) / 2,
							image.naturalWidth * ratio,
							image.naturalHeight * ratio,
						);
					}
				} else if (stroke.shape === "square") {
					context.fillStyle = "white";
					context.fillRect(point.x - radius, point.y - radius, stroke.size, stroke.size);
				} else {
					if (stroke.hardness >= 1) context.fillStyle = "white";
					else {
						const gradient = context.createRadialGradient(
							point.x,
							point.y,
							radius * stroke.hardness,
							point.x,
							point.y,
							radius,
						);
						gradient.addColorStop(0, "rgba(255,255,255,1)");
						gradient.addColorStop(1, "rgba(255,255,255,0)");
						context.fillStyle = gradient;
					}
					context.beginPath();
					context.arc(point.x, point.y, radius, 0, Math.PI * 2);
					context.fill();
				}
			}
			context.restore();
		});

	const composeLayerFx = (
		layer: TilePaintingDocumentSchema.Layer,
		mask: HTMLCanvasElement,
		target: HTMLCanvasElement,
		changed?: Bounds,
	) =>
		Effect.gen(function* () {
			const context = yield* readContextFx(target);
			context.save();
			if (changed !== undefined) yield* clipContextFx(context, changed);
			context.clearRect(0, 0, target.width, target.height);
			const image = images.get(layer.imageId);
			if (image !== undefined) {
				const pattern = context.createPattern(image, "repeat");
				if (pattern !== null) {
					pattern.setTransform(
						new DOMMatrix().scale(layer.tileSize / image.naturalWidth),
					);
					context.fillStyle = pattern;
					context.fillRect(0, 0, target.width, target.height);
					context.globalCompositeOperation = "destination-in";
					context.drawImage(mask, 0, 0);
				}
			}
			context.restore();
		});

	const composeShadowFx = (
		layer: TilePaintingDocumentSchema.Layer,
		composite: HTMLCanvasElement,
		previous?: HTMLCanvasElement,
		dirty?: Bounds,
	) =>
		Effect.gen(function* () {
			const shadow = layer.shadow ?? TilePaintingDefaultShadow;
			if (!shadow?.enabled || shadow.opacity === 0) return undefined;
			shadowImprint ??= yield* createCanvasFx(composite.width, composite.height);
			const imprintContext = yield* readContextFx(shadowImprint);
			const changed =
				previous === undefined || dirty === undefined
					? undefined
					: readShadowBoundsFn(layer, dirty);
			imprintContext.save();
			if (changed !== undefined && changed !== "full") {
				// The shared imprint may contain another layer outside this source halo. The
				// extra blur support keeps those pixels outside the updated shadow's kernel.
				yield* clipContextFx(
					imprintContext,
					expandBoundsFn(
						changed,
						Math.ceil(shadow.blur * 3) + 2,
						-shadow.offsetX,
						-shadow.offsetY,
					),
				);
			}
			imprintContext.clearRect(0, 0, composite.width, composite.height);
			imprintContext.drawImage(composite, 0, 0);
			imprintContext.globalCompositeOperation = "source-in";
			imprintContext.fillStyle = shadow.color;
			imprintContext.fillRect(0, 0, composite.width, composite.height);
			imprintContext.restore();
			const target = previous ?? (yield* createCanvasFx(composite.width, composite.height));
			const targetContext = yield* readContextFx(target);
			targetContext.save();
			if (changed !== undefined && changed !== "full")
				yield* clipContextFx(targetContext, changed);
			targetContext.clearRect(0, 0, target.width, target.height);
			targetContext.filter = shadow.blur === 0 ? "none" : `blur(${shadow.blur}px)`;
			targetContext.drawImage(shadowImprint, shadow.offsetX, shadow.offsetY);
			targetContext.restore();
			return target;
		});

	const paintStampsFx = (
		canvas: HTMLCanvasElement,
		stamps: ReadonlyArray<TilePaintingDocumentSchema.Stamp>,
		start = 0,
	) =>
		Effect.gen(function* () {
			const context = yield* readContextFx(canvas);
			for (let index = start; index < stamps.length; index += 1) {
				const stamp = stamps[index];
				const image = images.get(stamp.imageId);
				if (image === undefined) continue;
				const ratio = stamp.size / Math.max(image.naturalWidth, image.naturalHeight);
				context.drawImage(
					image,
					stamp.x - (image.naturalWidth * ratio) / 2,
					stamp.y - (image.naturalHeight * ratio) / 2,
					image.naturalWidth * ratio,
					image.naturalHeight * ratio,
				);
			}
		});

	const drawReferenceFx = (
		painting: TilePaintingDocumentSchema.Type,
		canvas: HTMLCanvasElement,
		outputContext: CanvasRenderingContext2D,
	) =>
		Effect.sync(() => {
			if (painting.reference?.visible) {
				const image = images.get(painting.reference.imageId);
				if (image !== undefined) {
					const scale = Math.min(
						canvas.width / image.naturalWidth,
						canvas.height / image.naturalHeight,
					);
					outputContext.globalAlpha = painting.reference.opacity;
					outputContext.drawImage(
						image,
						(canvas.width - image.naturalWidth * scale) / 2,
						(canvas.height - image.naturalHeight * scale) / 2,
						image.naturalWidth * scale,
						image.naturalHeight * scale,
					);
				}
			}
		});

	return {
		renderFx: Effect.fn("TilePaintingRenderer.renderFx")(function* ({
			document: painting,
			canvas,
			referenceOnly = false,
			previewOpacity = 1,
			includeReference = false,
			pending,
			deferShadows = false,
		}) {
			const adoptedLayerIds: string[] = [];
			const replayedLayerIds: string[] = [];
			const resized =
				canvas.width !== TilePaintingCanvasSize || canvas.height !== TilePaintingCanvasSize;
			if (canvas.width !== TilePaintingCanvasSize) canvas.width = TilePaintingCanvasSize;
			if (canvas.height !== TilePaintingCanvasSize) canvas.height = TilePaintingCanvasSize;
			let sceneDirty: DirtyRegion =
				scene === undefined ||
				scene.painting !== painting ||
				scene.canvas !== canvas ||
				resized ||
				scene.includeReference !== includeReference ||
				scene.previewOpacity !== previewOpacity ||
				referenceOnly ||
				(scene.stroke !== undefined && scene.stroke !== pending?.stroke) ||
				(scene.scatter !== undefined && scene.scatter !== pending?.scatter) ||
				(scene.stroke !== undefined &&
					(scene.layerIds.length !== pending?.layerIds.length ||
						scene.layerIds.some((id, index) => id !== pending?.layerIds[index])))
					? "full"
					: undefined;
			const outputContext = yield* readContextFx(canvas);
			if (referenceOnly) {
				outputContext.clearRect(0, 0, canvas.width, canvas.height);
				if (includeReference) yield* drawReferenceFx(painting, canvas, outputContext);
				outputContext.globalAlpha = 1;
				scene = undefined;
				return {
					changed: "full" as const,
					adoptedLayerIds,
					replayedLayerIds,
				};
			}
			const context = yield* readContextFx(terrain);
			const visibleLayers: {
				layer: TilePaintingDocumentSchema.Layer;
				composite: HTMLCanvasElement;
				shadow?: HTMLCanvasElement;
			}[] = [];
			for (const id of layers.keys())
				if (!painting.layers.some((layer) => layer.id === id)) layers.delete(id);
			// Array order is bottom to top, matching the setup page's explicit stack order.
			for (const layer of painting.layers) {
				if (!layer.visible || layer.opacity === 0) continue;
				let cached = layers.get(layer.id);
				if (cached === undefined) {
					replayedLayerIds.push(layer.id);
					cached = {
						layer,
						mask: yield* createCanvasFx(canvas.width, canvas.height),
						composite: yield* createCanvasFx(canvas.width, canvas.height),
						shadowDirty: "full",
					};
					for (const stroke of layer.strokes) yield* paintDabsFx(cached.mask, stroke, 0);
					yield* composeLayerFx(layer, cached.mask, cached.composite);
					layers.set(layer.id, cached);
				} else if (cached.layer !== layer) {
					let compositeDirty =
						cached.layer.imageId !== layer.imageId ||
						cached.layer.tileSize !== layer.tileSize;
					if (compositeDirty || cached.layer.shadow !== layer.shadow)
						cached.shadowDirty = "full";
					if (cached.layer.strokes !== layer.strokes) {
						const append =
							cached.layer.strokes.length <= layer.strokes.length &&
							cached.layer.strokes.every(
								(stroke, index) => stroke === layer.strokes[index],
							);
						const draft = drafts.get(layer.id);
						const finalStroke = layer.strokes.at(-1);
						// A completed gesture may have an unrendered pointer-up tail. Adopt only its
						// verified projection; undo, replacement and unrelated edits rebuild normally.
						const adopt =
							append &&
							layer.strokes.length === cached.layer.strokes.length + 1 &&
							draft !== undefined &&
							draft.source === cached.layer &&
							finalStroke !== undefined &&
							draft.stroke.mode === finalStroke.mode &&
							draft.stroke.size === finalStroke.size &&
							draft.stroke.opacity === finalStroke.opacity &&
							draft.stroke.hardness === finalStroke.hardness &&
							draft.stroke.shape === finalStroke.shape &&
							draft.stroke.brushImageId === finalStroke.brushImageId &&
							draft.painted <= finalStroke.points.length &&
							draft.stroke.points
								.slice(0, draft.painted)
								.every((point, index) => point === finalStroke.points[index]);
						if (adopt) {
							adoptedLayerIds.push(layer.id);
							cached.mask = draft.mask;
							cached.composite = draft.composite;
							if (draft.painted < finalStroke.points.length) {
								yield* paintDabsFx(cached.mask, finalStroke, draft.painted);
								compositeDirty = true;
							}
						} else {
							replayedLayerIds.push(layer.id);
							const start = append ? cached.layer.strokes.length : 0;
							if (!append)
								(yield* readContextFx(cached.mask)).clearRect(
									0,
									0,
									canvas.width,
									canvas.height,
								);
							for (let index = start; index < layer.strokes.length; index += 1)
								yield* paintDabsFx(cached.mask, layer.strokes[index], 0);
							compositeDirty = true;
						}
						if (append) {
							for (
								let index = cached.layer.strokes.length;
								index < layer.strokes.length;
								index += 1
							)
								cached.shadowDirty = unionRegionFn(
									cached.shadowDirty,
									readDabBoundsFn(layer.strokes[index], 0),
								);
						} else cached.shadowDirty = "full";
						drafts.delete(layer.id);
					}
					if (compositeDirty) {
						yield* composeLayerFx(layer, cached.mask, cached.composite);
					}
					cached.layer = layer;
				}
				if (cached.shadowDirty && !deferShadows) {
					sceneDirty = unionRegionFn(
						sceneDirty,
						readShadowBoundsFn(layer, cached.shadowDirty),
					);
					cached.shadow = yield* composeShadowFx(
						layer,
						cached.composite,
						cached.shadow,
						cached.shadowDirty === "full" ? undefined : cached.shadowDirty,
					);
					cached.shadowDirty = undefined;
				}
				let composite = cached.composite;
				let shadow = cached.shadow;
				if (pending?.layerIds.includes(layer.id) && pending.stroke !== undefined) {
					let draft = drafts.get(layer.id);
					if (
						draft === undefined ||
						draft.source !== layer ||
						draft.stroke !== pending.stroke ||
						draft.painted > pending.stroke.points.length
					) {
						if (draft !== undefined) sceneDirty = "full";
						const mask = yield* createCanvasFx(canvas.width, canvas.height);
						(yield* readContextFx(mask)).drawImage(cached.mask, 0, 0);
						const draftComposite = yield* createCanvasFx(canvas.width, canvas.height);
						(yield* readContextFx(draftComposite)).drawImage(cached.composite, 0, 0);
						draft = {
							source: layer,
							mask,
							composite: draftComposite,
							stroke: pending.stroke,
							painted: 0,
							shadowDirty: "full",
						};
						drafts.set(layer.id, draft);
					}
					if (draft.painted < pending.stroke.points.length) {
						yield* paintDabsFx(draft.mask, pending.stroke, draft.painted);
						const changed = readDabBoundsFn(pending.stroke, draft.painted);
						yield* composeLayerFx(layer, draft.mask, draft.composite, changed);
						sceneDirty = unionRegionFn(sceneDirty, changed);
						draft.painted = pending.stroke.points.length;
						draft.shadowDirty = unionRegionFn(draft.shadowDirty, changed);
					}
					if (draft.shadowDirty && !deferShadows) {
						sceneDirty = unionRegionFn(
							sceneDirty,
							readShadowBoundsFn(layer, draft.shadowDirty),
						);
						draft.shadow = yield* composeShadowFx(
							layer,
							draft.composite,
							draft.shadow,
							draft.shadowDirty === "full" ? undefined : draft.shadowDirty,
						);
						draft.shadowDirty = undefined;
					}
					composite = draft.composite;
					shadow = draft.shadow ?? cached.shadow;
				}
				// Keep the last computed shadow during input; settlement replaces its coverage.
				if (cached.displayedShadow !== shadow) sceneDirty = "full";
				cached.displayedShadow = shadow;
				visibleLayers.push({
					layer,
					composite,
					shadow,
				});
			}
			for (const id of drafts.keys())
				if (pending?.stroke === undefined || !pending.layerIds.includes(id))
					drafts.delete(id);
			if (
				scatterCache === undefined ||
				scatterCache.canvas.width !== canvas.width ||
				scatterCache.canvas.height !== canvas.height ||
				scatterCache.strokes !== painting.scatter
			) {
				const append =
					scatterCache !== undefined &&
					scatterCache.canvas.width === canvas.width &&
					scatterCache.canvas.height === canvas.height &&
					scatterCache.strokes.length <= painting.scatter.length &&
					scatterCache.strokes.every(
						(stroke, index) => stroke === painting.scatter[index],
					);
				const start = append ? scatterCache!.strokes.length : 0;
				const target = append
					? scatterCache!.canvas
					: yield* createCanvasFx(canvas.width, canvas.height);
				for (let index = start; index < painting.scatter.length; index += 1)
					yield* paintStampsFx(target, painting.scatter[index].stamps);
				scatterCache = {
					strokes: painting.scatter,
					canvas: target,
				};
			}
			if (pending?.scatter !== undefined) {
				if (
					scatterDraft === undefined ||
					scatterDraft.stroke !== pending.scatter ||
					scatterDraft.painted > pending.scatter.stamps.length
				) {
					if (scatterDraft !== undefined) sceneDirty = "full";
					scatterDraft = {
						stroke: pending.scatter,
						canvas: yield* createCanvasFx(canvas.width, canvas.height),
						painted: 0,
					};
				}
				sceneDirty = unionRegionFn(
					sceneDirty,
					readStampBoundsFn(pending.scatter.stamps, scatterDraft.painted),
				);
				yield* paintStampsFx(
					scatterDraft.canvas,
					pending.scatter.stamps,
					scatterDraft.painted,
				);
				scatterDraft.painted = pending.scatter.stamps.length;
			} else scatterDraft = undefined;
			if (sceneDirty !== undefined) {
				context.save();
				outputContext.save();
				if (sceneDirty !== "full") {
					yield* clipContextFx(context, sceneDirty);
					yield* clipContextFx(outputContext, sceneDirty);
				}
				outputContext.clearRect(0, 0, canvas.width, canvas.height);
				outputContext.globalAlpha = 1;
				if (includeReference) yield* drawReferenceFx(painting, canvas, outputContext);
				context.clearRect(0, 0, terrain.width, terrain.height);
				for (const { layer, composite, shadow } of visibleLayers) {
					if (shadow !== undefined) {
						// Only authored lower terrain receives a shadow; source-atop preserves its alpha.
						context.globalCompositeOperation = "source-atop";
						context.globalAlpha =
							layer.opacity *
							previewOpacity *
							(layer.shadow ?? TilePaintingDefaultShadow).opacity;
						context.drawImage(shadow, 0, 0);
						context.globalCompositeOperation = "source-over";
					}
					context.globalAlpha = layer.opacity * previewOpacity;
					context.drawImage(composite, 0, 0);
				}
				context.globalAlpha = previewOpacity;
				context.drawImage(scatterCache.canvas, 0, 0);
				if (scatterDraft !== undefined) context.drawImage(scatterDraft.canvas, 0, 0);
				outputContext.globalAlpha = 1;
				outputContext.drawImage(terrain, 0, 0);

				context.restore();
				outputContext.restore();
			}
			scene = {
				painting,
				canvas,
				includeReference,
				previewOpacity,
				stroke: pending?.stroke,
				scatter: pending?.scatter,
				layerIds: pending?.layerIds ?? [],
			};
			return {
				changed: sceneDirty ?? "none",
				adoptedLayerIds,
				replayedLayerIds,
			};
		}),
	};
});
