import { Effect } from "effect";
import { Rectangle } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { MainLayout } from "~/game-scene/type/SceneLayout";

interface Props {
	readonly application: PixiApplicationOwner;
	readonly drag: MainDragController;
	readonly dragThreshold: number;
	readonly layout: MainLayout;
}

export namespace createMainCameraFx {
	export interface Output {
		readonly cancelInteractionFx: Effect.Effect<void>;
		readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
		readonly closeFx: Effect.Effect<void>;
	}
}

/** One camera transforms every main-scene layer; actor and drop coordinates remain world-local. */
export const createMainCameraFx = Effect.fn("createMainCameraFx")(function* ({
	application,
	drag,
	dragThreshold,
	layout,
}: Props) {
	const { app, stage, frames } = application;
	const canvas = app.canvas;
	let width = app.screen.width;
	let height = app.screen.height;
	let blocked = false;
	let closed = false;
	let pan: {
		readonly pointerId: number;
		phase: "pressed" | "dragging";
		x: number;
		y: number;
	} | null = null;
	const left = Math.min(layout.board.x, layout.toolbar?.x ?? layout.board.x);
	const right = Math.max(
		layout.board.x + layout.board.width,
		(layout.toolbar?.x ?? 0) + (layout.toolbar?.width ?? 0),
	);
	const bottom =
		layout.toolbar === null
			? layout.board.y + layout.board.height
			: layout.toolbar.y + layout.toolbar.height;

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
	const fitFn = () => {
		const scale = Math.min(width / (right - left + 256), height / (bottom + 256), 1);
		stage.scale.set(scale);
		stage.position.set((width - (right + left) * scale) / 2, (height - bottom * scale) / 2);
		invalidateFn();
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
		if (
			closed ||
			blocked ||
			pan !== null ||
			event.target !== canvas ||
			event.button !== 2 ||
			!event.isPrimary
		)
			return;
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
		if (pan === null || event.pointerId !== pan.pointerId) return;
		if (event.type === "pointerup") pointerMoveFn(event);
		if (pan?.phase === "dragging") event.stopImmediatePropagation();
		finishPanFn();
	};
	const wheelFn = (event: WheelEvent) => {
		if (closed || blocked) return;
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
			0.02,
			Math.min(8, stage.scale.x * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002))),
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
	canvas.addEventListener("lostpointercapture", pointerUpFn);
	canvas.addEventListener("wheel", wheelFn, {
		passive: false,
	});
	document.addEventListener("visibilitychange", visibilityFn);
	fitFn();

	return {
		cancelInteractionFx: Effect.sync(cancelFn),
		setInteractionBlockedFx: (nextBlocked: boolean) =>
			Effect.sync(() => {
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
			canvas.removeEventListener("lostpointercapture", pointerUpFn);
			canvas.removeEventListener("wheel", wheelFn);
			document.removeEventListener("visibilitychange", visibilityFn);
		}),
	} satisfies createMainCameraFx.Output;
});
