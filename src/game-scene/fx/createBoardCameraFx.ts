import { Clock, Effect } from "effect";
import { Rectangle } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

import { readBoardEdgePanFn } from "~/game-scene/fn/readBoardEdgePanFn";

import type { AnimationControl, AnimationDriver } from "~/tile-rendering/service/AnimationDriver";

interface Props {
	readonly animationDriver: AnimationDriver;
	readonly application: PixiApplicationOwner;
	readonly drag: {
		readonly cancelInteractionFx: Effect.Effect<void>;
		readonly refreshPointerFx?: (pointer: {
			readonly pointerId: number;
			readonly x: number;
			readonly y: number;
		}) => Effect.Effect<void>;
		readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	};
	readonly dragThreshold: number;
	readonly surfaces: readonly [
		SurfaceLayout,
		...SurfaceLayout[],
	];
}

export namespace createBoardCameraFx {
	export interface Output {
		readonly cancelInteractionFx: Effect.Effect<void>;
		readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
		readonly setSurfacesFx: (
			surfaces: Props["surfaces"],
			options: {
				readonly animate: boolean;
			},
		) => Effect.Effect<void>;
		readonly closeFx: Effect.Effect<void>;
	}
}

/** One camera transforms every canvas layer; actor and drop coordinates remain world-local. */
export const createBoardCameraFx = Effect.fn("createBoardCameraFx")(function* ({
	animationDriver,
	application,
	drag,
	dragThreshold,
	surfaces,
}: Props) {
	const { app, stage, frames } = application;
	const canvas = app.canvas;
	const clock = yield* Clock.Clock;
	let edgePointer: {
		pointerId: number;
		clientX: number;
		clientY: number;
	} | null = null;
	let cancelEdgeFrameFn: (() => void) | null = null;
	let edgeFrameTime = 0;
	let width = app.screen.width;
	let height = app.screen.height;
	let blocked = false;
	let fitAnimation: AnimationControl | null = null;
	let fitGeneration = 0;
	const stopFitFn = () => {
		fitGeneration += 1;
		if (fitAnimation !== null) RendererRuntime.runSync(fitAnimation.stopFx);
		fitAnimation = null;
	};
	let closed = false;
	let pan: {
		readonly pointerId: number;
		phase: "pressed" | "dragging";
		x: number;
		y: number;
	} | null = null;
	let left = Math.min(...surfaces.map((surface) => surface.x));
	let top = Math.min(...surfaces.map((surface) => surface.y));
	let right = Math.max(...surfaces.map((surface) => surface.x + surface.width));
	let bottom = Math.max(...surfaces.map((surface) => surface.y + surface.height));

	let cameraSurface: SurfaceLayout = {
		...surfaces[0],
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
	};

	const invalidateFn = () => {
		// Pixi hitArea is local even though it covers the whole screen, including empty space.
		stage.hitArea = new Rectangle(
			-stage.x / stage.scale.x,
			-stage.y / stage.scale.y,
			width / stage.scale.x,
			height / stage.scale.y,
		);
		RendererRuntime.runSync(frames.invalidateFx);
	};
	const stopEdgePanFn = () => {
		cancelEdgeFrameFn?.();
		cancelEdgeFrameFn = null;
		edgePointer = null;
	};
	const readEdgePositionFn = (deltaMs: number) => {
		if (edgePointer === null || closed || blocked || pan !== null) return null;
		const bounds = canvas.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return null;
		const pointerX = ((edgePointer.clientX - bounds.left) * width) / bounds.width;
		const pointerY = ((edgePointer.clientY - bounds.top) * height) / bounds.height;
		return readBoardEdgePanFn({
			board: cameraSurface,
			width,
			height,
			x: stage.x,
			y: stage.y,
			scale: stage.scale.x,
			pointerX,
			pointerY,
			deltaMs,
		});
	};
	const edgeFrameFn = () => {
		cancelEdgeFrameFn = null;
		const now = clock.currentTimeMillisUnsafe();
		const next = readEdgePositionFn(Math.max(1, Math.min(50, now - edgeFrameTime)));
		edgeFrameTime = now;
		if (next === null || (next.x === stage.x && next.y === stage.y)) return;
		stage.position.set(next.x, next.y);
		if (edgePointer !== null && drag.refreshPointerFx !== undefined) {
			const bounds = canvas.getBoundingClientRect();
			RendererRuntime.runSync(
				drag.refreshPointerFx({
					pointerId: edgePointer.pointerId,
					x: ((edgePointer.clientX - bounds.left) * width) / bounds.width,
					y: ((edgePointer.clientY - bounds.top) * height) / bounds.height,
				}),
			);
		}
		invalidateFn();
		cancelEdgeFrameFn = RendererRuntime.runSync(frames.scheduleFx(edgeFrameFn));
	};
	const trackEdgePointerFn = (event: PointerEvent) => {
		if (
			event.target !== canvas ||
			(event.buttons & ~1) !== 0 ||
			blocked ||
			closed ||
			pan !== null ||
			!event.isPrimary
		) {
			stopEdgePanFn();
			return;
		}
		if (fitAnimation !== null) return;
		edgePointer = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
		};
		const next = readEdgePositionFn(1);
		if (next === null || (next.x === stage.x && next.y === stage.y)) {
			stopEdgePanFn();
			return;
		}
		if (cancelEdgeFrameFn !== null) return;
		edgeFrameTime = clock.currentTimeMillisUnsafe();
		cancelEdgeFrameFn = RendererRuntime.runSync(frames.scheduleFx(edgeFrameFn));
	};
	const fitFn = (animate = false) => {
		stopFitFn();
		const scale = Math.min(width / (right - left + 256), height / (bottom - top + 256), 1);
		const x = (width - (right + left) * scale) / 2;
		const y = (height - (bottom + top) * scale) / 2;
		if (!animate) {
			stage.scale.set(scale);
			stage.position.set(x, y);
			invalidateFn();
			return;
		}
		const from = {
			x: stage.x,
			y: stage.y,
			scale: stage.scale.x,
		};
		const generation = fitGeneration;
		fitAnimation = RendererRuntime.runSync(
			animationDriver.startTweenFx({
				from: 0,
				to: 1,
				durationMs: 650,
				curve: {
					kind: "ease-in-out",
				},
				onCompleteFn: () => {
					if (generation === fitGeneration) fitAnimation = null;
				},
				onUpdateFn: (progress) => {
					if (closed || generation !== fitGeneration) return;
					stage.scale.set(from.scale + (scale - from.scale) * progress);
					stage.position.set(
						from.x + (x - from.x) * progress,
						from.y + (y - from.y) * progress,
					);
					invalidateFn();
				},
			}),
		);
	};
	const updateInteractionFn = () => {
		const panning = pan?.phase === "dragging";
		canvas.style.setProperty("cursor", panning ? "grabbing" : "grab", "important");
		if (!panning) canvas.style.removeProperty("cursor");
		RendererRuntime.runSync(drag.setInteractionBlockedFx(blocked || panning));
	};
	const finishPanFn = () => {
		const previous = pan;
		pan = null;
		if (previous !== null && canvas.hasPointerCapture(previous.pointerId)) {
			canvas.releasePointerCapture(previous.pointerId);
		}
		updateInteractionFn();
	};
	const cancelFn = () => {
		stopFitFn();
		stopEdgePanFn();
		finishPanFn();
		RendererRuntime.runSync(drag.cancelInteractionFx);
	};
	const resetKeyFn = (event: KeyboardEvent) => {
		if (
			closed ||
			blocked ||
			event.defaultPrevented ||
			event.key !== "0" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		)
			return;
		if (
			event.target instanceof Element &&
			event.target.closest("input, textarea, select, [contenteditable]")
		)
			return;
		event.preventDefault();
		cancelFn();
		fitFn();
	};
	const pointerDownFn = (event: PointerEvent) => {
		stopEdgePanFn();
		if (
			closed ||
			blocked ||
			pan !== null ||
			event.target !== canvas ||
			event.button !== 2 ||
			!event.isPrimary
		)
			return;
		stopFitFn();
		pan = {
			phase: "pressed",
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
		};
		canvas.setPointerCapture(event.pointerId);
		updateInteractionFn();
	};
	const pointerMoveFn = (event: PointerEvent) => {
		trackEdgePointerFn(event);
		if (pan === null || event.pointerId !== pan.pointerId) return;
		if (pan.phase === "pressed") {
			if (Math.hypot(event.clientX - pan.x, event.clientY - pan.y) < dragThreshold) return;
			// A short right click still belongs to the tile. Only a drag takes its gesture away.
			pan.phase = "dragging";
			updateInteractionFn();
			canvas.setPointerCapture(event.pointerId);
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		const bounds = canvas.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;
		stage.x += ((event.clientX - pan.x) * width) / bounds.width;
		stage.y += ((event.clientY - pan.y) * height) / bounds.height;
		pan.x = event.clientX;
		pan.y = event.clientY;
		invalidateFn();
	};
	const pointerUpFn = (event: PointerEvent) => {
		stopEdgePanFn();
		if (pan === null || event.pointerId !== pan.pointerId) return;
		if (event.type === "pointerup") pointerMoveFn(event);
		if (pan?.phase === "dragging") event.stopImmediatePropagation();
		finishPanFn();
		stopEdgePanFn();
	};
	const wheelFn = (event: WheelEvent) => {
		if (closed || blocked) return;
		stopFitFn();
		stopEdgePanFn();
		event.preventDefault();
		if (pan !== null) return;
		const bounds = canvas.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;
		RendererRuntime.runSync(drag.cancelInteractionFx);
		const x = ((event.clientX - bounds.left) * width) / bounds.width;
		const y = ((event.clientY - bounds.top) * height) / bounds.height;
		const delta =
			event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
		const nextScale = Math.max(
			0.08,
			Math.min(1.65, stage.scale.x * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002))),
		);
		const ratio = nextScale / stage.scale.x;
		stage.position.set(x - (x - stage.x) * ratio, y - (y - stage.y) * ratio);
		stage.scale.set(nextScale);
		invalidateFn();
	};
	const visibilityFn = () => {
		if (document.hidden) cancelFn();
	};
	const removeResizeFn = yield* application.addResizeListenerFx(() => {
		cancelFn();
		stage.x += (app.screen.width - width) / 2;
		stage.y += (app.screen.height - height) / 2;
		width = app.screen.width;
		height = app.screen.height;
		invalidateFn();
	});
	window.addEventListener("keydown", resetKeyFn);
	window.addEventListener("blur", cancelFn);
	window.addEventListener("pointerdown", pointerDownFn, true);
	window.addEventListener("pointermove", pointerMoveFn, true);
	window.addEventListener("pointerup", pointerUpFn, true);
	window.addEventListener("pointercancel", pointerUpFn, true);
	canvas.addEventListener("pointerleave", stopEdgePanFn);
	canvas.addEventListener("lostpointercapture", pointerUpFn);
	canvas.addEventListener("wheel", wheelFn, {
		passive: false,
	});
	document.addEventListener("visibilitychange", visibilityFn);
	fitFn();

	return {
		cancelInteractionFx: Effect.sync(cancelFn),
		setSurfacesFx: (nextSurfaces, options) =>
			Effect.sync(() => {
				cancelFn();
				left = Math.min(...nextSurfaces.map((surface) => surface.x));
				top = Math.min(...nextSurfaces.map((surface) => surface.y));
				right = Math.max(...nextSurfaces.map((surface) => surface.x + surface.width));
				bottom = Math.max(...nextSurfaces.map((surface) => surface.y + surface.height));
				cameraSurface = {
					...nextSurfaces[0],
					x: left,
					y: top,
					width: right - left,
					height: bottom - top,
				};
				fitFn(options.animate);
			}),
		setInteractionBlockedFx: (nextBlocked: boolean) =>
			Effect.sync(() => {
				if (blocked === nextBlocked) return;
				blocked = nextBlocked;
				if (blocked) cancelFn();
				else updateInteractionFn();
			}),
		closeFx: Effect.sync(() => {
			if (closed) return;
			closed = true;
			cancelFn();
			removeResizeFn();
			window.removeEventListener("keydown", resetKeyFn);
			window.removeEventListener("blur", cancelFn);
			window.removeEventListener("pointerdown", pointerDownFn, true);
			window.removeEventListener("pointermove", pointerMoveFn, true);
			window.removeEventListener("pointerup", pointerUpFn, true);
			window.removeEventListener("pointercancel", pointerUpFn, true);
			canvas.removeEventListener("pointerleave", stopEdgePanFn);
			canvas.removeEventListener("lostpointercapture", pointerUpFn);
			canvas.removeEventListener("wheel", wheelFn);
			document.removeEventListener("visibilitychange", visibilityFn);
		}),
	} satisfies createBoardCameraFx.Output;
});
