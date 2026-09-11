import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import { Effect } from "effect";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { createTilePaintingScatterStampsFx } from "~/tile-painting/fx/createTilePaintingScatterStampsFx";
import { sampleTilePaintingDabsFn } from "~/tile-painting/fn/sampleTilePaintingDabsFn";
import { createTilePaintingRendererFx } from "~/tile-painting/fx/createTilePaintingRendererFx";
import type { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

interface PaintGesture {
	readonly kind: "paint";
	readonly pointerId: number;
	readonly document: TilePaintingDocumentSchema.Type;
	readonly layerIds: ReadonlyArray<string>;
	readonly spacing: number;
	readonly radius: number;
	lastPoint: TilePaintingDocumentSchema.Point;
	distanceToNext: number;
	stroke?: TilePaintingDocumentSchema.Stroke;
	scatter?: TilePaintingDocumentSchema.ScatterStroke;
}

interface PanGesture {
	readonly kind: "pan";
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly view: makeTilePaintingSessionFx.View;
}

export namespace attachTilePaintingCanvasFx {
	export interface Props {
		readonly session: makeTilePaintingSessionFx.Output;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly viewportElement: HTMLDivElement;
		readonly canvas: HTMLCanvasElement;
		readonly cursorElement: HTMLDivElement;
		readonly loadingElement: HTMLDivElement;
	}
	export interface Output {
		readonly setResourcesFx: (
			resources: ReadonlyArray<ResourceSchema.Type>,
		) => Effect.Effect<void>;
		readonly setBrushImageUrlFx: (url: string | undefined) => Effect.Effect<void>;
		readonly setSuspendedFx: (suspended: boolean) => Effect.Effect<void>;
	}
}

const readCanvasImageIdsFn = (current: makeTilePaintingSessionFx.Snapshot): ReadonlySet<string> => {
	const ids = new Set(readTilePaintingReferencedImageIdsFn(current.document));
	if (current.brush.shape === "image" && current.brush.brushImageId !== null)
		ids.add(current.brush.brushImageId);
	return ids;
};

/** Native input and disposable render resources read the session directly; React only attaches the surface. */
export const attachTilePaintingCanvasFx = (props: attachTilePaintingCanvasFx.Props) =>
	Effect.acquireRelease(
		Effect.sync(() => {
			const { session, viewportElement, canvas, cursorElement, loadingElement } = props;
			let renderer: createTilePaintingRendererFx.Output | undefined;
			let resources = props.resources;
			let brushImageUrl: string | undefined;
			let loadedImageIds: ReadonlySet<string> = new Set();
			let decodeError: string | undefined;
			let activeGesture: PaintGesture | PanGesture | undefined;
			let cursorPosition:
				| {
						x: number;
						y: number;
				  }
				| undefined;
			let suspended = false;
			let disposed = false;
			let decoder: AbortController | undefined;
			let viewport = {
				width: 640,
				height: 480,
			};
			let geometry = {
				scale: 1,
				originX: 0,
				originY: 0,
				width: 640,
				height: 480,
			};
			const isDisabledFn = () => suspended || session.readFn().busy;
			const reportErrorFn = (message: string) =>
				RendererRuntime.runSync(session.setErrorFx(message));
			const commitFn = (document: TilePaintingDocumentSchema.Type) =>
				RendererRuntime.runSync(session.editFx(document));
			const setViewFn = (view: makeTilePaintingSessionFx.View) =>
				RendererRuntime.runSync(session.setViewFx(view));
			let space = false;
			let frame: number | undefined;
			let shadowTimer: ReturnType<typeof setTimeout> | undefined;
			let deferShadows = true;
			const updateBrushAppearanceFn = () => {
				const element = cursorElement;
				const current = session.readFn();
				const size = current.brush.size * geometry.scale;
				element.style.width = `${size}px`;
				element.style.height = `${size}px`;
				element.style.borderRadius =
					current.brush.shape !== "circle" && current.tool !== "scatter" ? "0" : "50%";
				element.style.backgroundImage =
					current.brush.shape === "image" && current.tool !== "scatter"
						? `url(${brushImageUrl ?? ""})`
						: "none";
				element.style.opacity =
					current.brush.shape === "image" && current.tool !== "scatter" ? "0.65" : "1";
				element.style.borderStyle = current.tool === "scatter" ? "dashed" : "solid";
			};
			const updateCursorFn = () => {
				const element = cursorElement;
				const point = cursorPosition;
				const current = session.readFn();

				const visible =
					point !== undefined &&
					!isDisabledFn() &&
					!current.referenceOnly &&
					activeGesture?.kind !== "pan";
				element.style.visibility = visible ? "visible" : "hidden";
				if (point !== undefined) {
					const radius = (current.brush.size * geometry.scale) / 2;
					element.style.transform = `translate(${point.x - radius}px, ${point.y - radius}px)`;
				}
			};

			const renderFn = () => {
				frame = undefined;
				const currentRenderer = renderer;
				if (currentRenderer === undefined) return;
				const current = session.readFn();
				const gesture = activeGesture;
				try {
					RendererRuntime.runSync(
						currentRenderer.renderFx({
							document: current.document,
							canvas,
							includeReference: true,
							referenceOnly: current.referenceOnly,
							previewOpacity: current.previewOpacity,
							deferShadows,
							pending:
								gesture?.kind === "paint"
									? {
											layerIds: gesture.layerIds,
											stroke: gesture.stroke,
											scatter: gesture.scatter,
										}
									: undefined,
						}),
					);
				} catch (error) {
					reportErrorFn(
						error instanceof Error ? error.message : "Could not render painting.",
					);
				}
			};
			const redrawFn = () => {
				deferShadows = true;
				if (shadowTimer !== undefined) clearTimeout(shadowTimer);
				shadowTimer = undefined;
				if (frame === undefined) frame = requestAnimationFrame(renderFn);
				// Keep expensive shadow filters out of the gesture and settle rapid edits together.
				if (activeGesture?.kind !== "paint")
					shadowTimer = setTimeout(() => {
						shadowTimer = undefined;
						deferShadows = false;
						if (frame === undefined) frame = requestAnimationFrame(renderFn);
					}, 180);
			};

			const cancelFn = () => {
				const gesture = activeGesture;
				activeGesture = undefined;
				if (gesture !== undefined && viewportElement.hasPointerCapture(gesture.pointerId))
					viewportElement.releasePointerCapture(gesture.pointerId);
				viewportElement.style.cursor = "crosshair";
				updateCursorFn();
				redrawFn();
			};

			const readPointFn = (event: PointerEvent) => {
				const rect = viewportElement.getBoundingClientRect();
				const currentGeometry = geometry;
				return {
					x: Math.max(
						-4096,
						Math.min(
							8192,
							(event.clientX - rect.left - currentGeometry.originX) /
								currentGeometry.scale,
						),
					),
					y: Math.max(
						-4096,
						Math.min(
							8192,
							(event.clientY - rect.top - currentGeometry.originY) /
								currentGeometry.scale,
						),
					),
				};
			};
			const extendPaintFn = (
				gesture: PaintGesture,
				point: TilePaintingDocumentSchema.Point,
			) => {
				const sampled = sampleTilePaintingDabsFn({
					from: gesture.lastPoint,
					to: point,
					spacing: gesture.spacing,
					distanceToNext: gesture.distanceToNext,
				});
				gesture.lastPoint = point;
				gesture.distanceToNext = sampled.distanceToNext;
				const points = sampled.points.filter(
					(point) =>
						point.x >= -gesture.radius &&
						point.y >= -gesture.radius &&
						point.x <= TilePaintingCanvasSize + gesture.radius &&
						point.y <= TilePaintingCanvasSize + gesture.radius,
				);
				if (points.length === 0) return;
				// These append-only arrays belong to the in-flight gesture; copy them at commit.
				if (gesture.stroke !== undefined) gesture.stroke.points.push(...points);
				if (gesture.scatter !== undefined)
					gesture.scatter.stamps.push(
						...RendererRuntime.runSync(
							createTilePaintingScatterStampsFx(
								gesture.document.catalog,
								points,
								gesture.radius,
							),
						),
					);
				redrawFn();
			};
			const pointerDownFn = (event: PointerEvent) => {
				const current = session.readFn();
				if (
					isDisabledFn() ||
					activeGesture !== undefined ||
					(event.button !== 0 && event.button !== 1)
				)
					return;
				event.preventDefault();
				if (event.button === 1 || space) {
					activeGesture = {
						kind: "pan",
						pointerId: event.pointerId,
						clientX: event.clientX,
						clientY: event.clientY,
						view: current.view,
					};
					viewportElement.style.cursor = "grabbing";
					updateCursorFn();
					viewportElement.setPointerCapture(event.pointerId);
					return;
				}
				if (renderer === undefined || current.referenceOnly) return;
				const point = readPointFn(event);
				if (
					point.x < 0 ||
					point.y < 0 ||
					point.x > TilePaintingCanvasSize ||
					point.y > TilePaintingCanvasSize
				)
					return;
				if (
					current.tool === "scatter" &&
					!current.document.catalog.some((item) => item.enabled && item.weight > 0)
				) {
					reportErrorFn("Enable at least one scattering image with a positive weight.");
					return;
				}
				const targetLayers = current.paintAllLayers
					? current.document.layers
					: current.document.layers.filter(
							(layer) => layer.id === current.activeLayerId && layer.visible,
						);
				if (current.tool !== "scatter") {
					if (targetLayers.length === 0) {
						reportErrorFn(
							current.paintAllLayers
								? "Add a texture layer before painting."
								: "Select a visible texture layer before painting.",
						);
						return;
					}
					if (
						current.brush.shape === "image" &&
						!current.document.images.some(
							(image) => image.id === current.brush.brushImageId,
						)
					) {
						reportErrorFn("Choose an image for the brush shape.");
						return;
					}
				}
				const spacing =
					current.tool === "scatter"
						? Math.max(1, current.scatterSpacing)
						: Math.max(1, current.brush.size * 0.12);
				activeGesture = {
					kind: "paint",
					pointerId: event.pointerId,
					document: current.document,
					layerIds: targetLayers.map((layer) => layer.id),
					spacing,
					radius: current.brush.size / 2,
					lastPoint: point,
					distanceToNext: spacing,
					stroke:
						current.tool === "scatter"
							? undefined
							: {
									...current.brush,
									mode: current.tool,
									points: [
										point,
									],
								},
					scatter:
						current.tool === "scatter"
							? {
									stamps: RendererRuntime.runSync(
										createTilePaintingScatterStampsFx(
											current.document.catalog,
											[
												point,
											],
											current.brush.size / 2,
										),
									),
								}
							: undefined,
				};
				viewportElement.setPointerCapture(event.pointerId);
				redrawFn();
			};
			const pointerMoveFn = (event: PointerEvent) => {
				const rect = viewportElement.getBoundingClientRect();
				cursorPosition = {
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
				};
				updateCursorFn();
				const gesture = activeGesture;
				if (gesture === undefined || gesture.pointerId !== event.pointerId) return;
				if (gesture.kind === "pan")
					setViewFn({
						...gesture.view,
						panX: gesture.view.panX + event.clientX - gesture.clientX,
						panY: gesture.view.panY + event.clientY - gesture.clientY,
					});
				else {
					const events = event.getCoalescedEvents?.() ?? [];
					for (const sample of events.length === 0
						? [
								event,
							]
						: events)
						extendPaintFn(gesture, readPointFn(sample));
				}
			};
			const pointerUpFn = (event: PointerEvent) => {
				const gesture = activeGesture;
				if (gesture === undefined || gesture.pointerId !== event.pointerId) return;
				if (gesture.kind === "paint") extendPaintFn(gesture, readPointFn(event));
				activeGesture = undefined;
				if (viewportElement.hasPointerCapture(event.pointerId))
					viewportElement.releasePointerCapture(event.pointerId);
				viewportElement.style.cursor = "crosshair";
				updateCursorFn();
				const current = session.readFn();
				if (
					gesture.kind === "paint" &&
					!isDisabledFn() &&
					gesture.document === current.document
				) {
					// The session commits synchronously before another native event can start a gesture.
					const painting = gesture.document;
					if (gesture.stroke !== undefined) {
						const stroke = {
							...gesture.stroke,
							points: [
								...gesture.stroke.points,
							],
						};
						commitFn({
							...painting,
							layers: painting.layers.map((layer) =>
								gesture.layerIds.includes(layer.id)
									? {
											...layer,
											strokes: [
												...layer.strokes,
												stroke,
											],
										}
									: layer,
							),
						});
					} else if (gesture.scatter !== undefined && gesture.scatter.stamps.length > 0)
						commitFn({
							...painting,
							scatter: [
								...painting.scatter,
								{
									stamps: [
										...gesture.scatter.stamps,
									],
								},
							],
						});
				}
				redrawFn();
			};
			const pointerLeaveFn = () => {
				cursorPosition = undefined;
				updateCursorFn();
			};
			const pointerCancelFn = (event: PointerEvent) => {
				if (activeGesture?.pointerId === event.pointerId) cancelFn();
			};
			const wheelFn = (event: WheelEvent) => {
				if (isDisabledFn()) return;
				event.preventDefault();
				if (activeGesture?.kind === "paint") return;
				const current = session.readFn();
				const currentGeometry = geometry;
				const rect = viewportElement.getBoundingClientRect();
				const zoom = Math.max(
					0.1,
					Math.min(16, current.view.zoom * Math.exp(-event.deltaY * 0.0015)),
				);
				const ratio = zoom / current.view.zoom;
				const x = event.clientX - rect.left - currentGeometry.width / 2;
				const y = event.clientY - rect.top - currentGeometry.height / 2;
				setViewFn({
					zoom,
					panX: x - (x - current.view.panX) * ratio,
					panY: y - (y - current.view.panY) * ratio,
				});
			};
			const keyDownFn = (event: KeyboardEvent) => {
				if (
					isDisabledFn() ||
					document.querySelector(
						"[data-ui='EditorPageHelpDialog'], [data-ui='TilePaintingDialog']",
					) !== null ||
					(event.target instanceof Element &&
						event.target.closest(
							"input, textarea, select, [contenteditable='true'], [data-ui='Modal']",
						))
				)
					return;
				if (event.code === "Space") {
					space = true;
					event.preventDefault();
				}
				if (event.key === "Escape") cancelFn();
			};
			const keyUpFn = (event: KeyboardEvent) => {
				if (event.code === "Space") space = false;
			};
			const blurFn = () => {
				space = false;
				cancelFn();
				cursorPosition = undefined;
				updateCursorFn();
			};
			viewportElement.addEventListener("pointerdown", pointerDownFn);
			viewportElement.addEventListener("pointermove", pointerMoveFn);
			viewportElement.addEventListener("pointerup", pointerUpFn);
			viewportElement.addEventListener("pointercancel", pointerCancelFn);
			viewportElement.addEventListener("lostpointercapture", pointerCancelFn);
			viewportElement.addEventListener("pointerleave", pointerLeaveFn);
			viewportElement.addEventListener("wheel", wheelFn, {
				passive: false,
			});
			window.addEventListener("keydown", keyDownFn);
			window.addEventListener("keyup", keyUpFn);
			window.addEventListener("blur", blurFn);
			redrawFn();
			const updateGeometryFn = () => {
				const view = session.readFn().view;
				const fit = Math.max(
					0.01,
					Math.min(
						(viewport.width - 48) / TilePaintingCanvasSize,
						(viewport.height - 48) / TilePaintingCanvasSize,
					),
				);
				const scale = fit * view.zoom;
				geometry = {
					scale,
					originX: (viewport.width - TilePaintingCanvasSize * scale) / 2 + view.panX,
					originY: (viewport.height - TilePaintingCanvasSize * scale) / 2 + view.panY,
					width: viewport.width,
					height: viewport.height,
				};
				canvas.style.left = `${geometry.originX}px`;
				canvas.style.top = `${geometry.originY}px`;
				canvas.style.width = `${TilePaintingCanvasSize * scale}px`;
				canvas.style.height = `${TilePaintingCanvasSize * scale}px`;
				updateBrushAppearanceFn();
				updateCursorFn();
			};
			const loadImagesFn = () => {
				decoder?.abort();
				const controller = new AbortController();
				decoder = controller;
				renderer = undefined;
				loadingElement.style.display = "";
				cancelFn();
				const current = session.readFn();
				loadedImageIds = readCanvasImageIdsFn(current);
				const sources = current.document.images.filter((image) =>
					loadedImageIds.has(image.id),
				);
				void RendererRuntime.runPromise(createTilePaintingRendererFx(sources, resources), {
					signal: controller.signal,
				})
					.then((result) => {
						if (disposed || controller.signal.aborted) return;
						renderer = result;
						if (decodeError !== undefined && session.readFn().error === decodeError)
							RendererRuntime.runSync(session.setErrorFx(null));
						decodeError = undefined;
						loadingElement.style.display = "none";
						redrawFn();
					})
					.catch((error: unknown) => {
						if (!disposed && !controller.signal.aborted) {
							decodeError =
								error instanceof Error
									? error.message
									: "Could not load painting images.";
							reportErrorFn(decodeError);
						}
					});
			};
			let previous = session.readFn();
			const unsubscribeFn = session.subscribeFn(() => {
				const current = session.readFn();
				const before = previous;
				previous = current;
				if (
					isDisabledFn() ||
					(activeGesture?.kind === "paint" && activeGesture.document !== current.document)
				)
					cancelFn();
				if (before.view !== current.view) updateGeometryFn();
				else {
					if (
						before.brush !== current.brush ||
						before.tool !== current.tool ||
						before.document.images !== current.document.images
					)
						updateBrushAppearanceFn();
					updateCursorFn();
				}
				const requiredImageIds =
					before.document !== current.document || before.brush !== current.brush
						? readCanvasImageIdsFn(current)
						: loadedImageIds;
				if (
					before.document.images !== current.document.images ||
					requiredImageIds.size !== loadedImageIds.size ||
					[
						...requiredImageIds,
					].some((id) => !loadedImageIds.has(id))
				)
					loadImagesFn();
				else if (
					before.document !== current.document ||
					before.referenceOnly !== current.referenceOnly ||
					before.previewOpacity !== current.previewOpacity
				)
					redrawFn();
			});
			const observer = new ResizeObserver((entries) => {
				const rect = entries[0]?.contentRect;
				if (rect === undefined) return;
				viewport = {
					width: rect.width,
					height: rect.height,
				};
				updateGeometryFn();
			});
			observer.observe(viewportElement);
			const rect = viewportElement.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0)
				viewport = {
					width: rect.width,
					height: rect.height,
				};
			updateGeometryFn();
			loadImagesFn();
			return {
				setResourcesFx: (next: ReadonlyArray<ResourceSchema.Type>) =>
					Effect.sync(() => {
						if (resources === next) return;
						resources = next;
						loadImagesFn();
					}),
				setBrushImageUrlFx: (url: string | undefined) =>
					Effect.sync(() => {
						brushImageUrl = url;
						updateBrushAppearanceFn();
					}),
				setSuspendedFx: (next: boolean) =>
					Effect.sync(() => {
						suspended = next;
						if (next) cancelFn();
						updateCursorFn();
					}),
				disposeFx: Effect.sync(() => {
					disposed = true;
					decoder?.abort();
					unsubscribeFn();
					observer.disconnect();
					const pointerId = activeGesture?.pointerId;

					activeGesture = undefined;
					if (frame !== undefined) cancelAnimationFrame(frame);
					if (shadowTimer !== undefined) clearTimeout(shadowTimer);
					viewportElement.removeEventListener("pointerdown", pointerDownFn);
					viewportElement.removeEventListener("pointermove", pointerMoveFn);
					viewportElement.removeEventListener("pointerup", pointerUpFn);
					viewportElement.removeEventListener("pointercancel", pointerCancelFn);
					viewportElement.removeEventListener("lostpointercapture", pointerCancelFn);
					viewportElement.removeEventListener("pointerleave", pointerLeaveFn);
					viewportElement.removeEventListener("wheel", wheelFn);
					window.removeEventListener("keydown", keyDownFn);
					window.removeEventListener("keyup", keyUpFn);
					window.removeEventListener("blur", blurFn);
					if (pointerId !== undefined && viewportElement.hasPointerCapture(pointerId))
						viewportElement.releasePointerCapture(pointerId);
					renderer = undefined;
				}),
			};
		}),
		(owner) => owner.disposeFx,
	).pipe(
		Effect.map(
			(owner): attachTilePaintingCanvasFx.Output => ({
				setSuspendedFx: owner.setSuspendedFx,
				setResourcesFx: owner.setResourcesFx,
				setBrushImageUrlFx: owner.setBrushImageUrlFx,
			}),
		),
	);
