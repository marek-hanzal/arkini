import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type { AnimationControl, AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import { readSurfaceRadiusFn } from "~/game-scene/fn/readSurfaceRadiusFn";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

interface CreateDropFeedbackProps {
	readonly animationDriver: AnimationDriver;
	readonly label: string;
}

interface FeedbackLayer {
	control: AnimationControl | null;
	generation: number;
	readonly graphics: Graphics;
}

const enterDurationMs = 130;
const exitDurationMs = 180;

const readTargetKeyFn = (
	color: number,
	slot: NonNullable<Parameters<DropFeedback["renderFx"]>[0]["slot"]>,
	surface: SurfaceLayout,
) =>
	[
		color,
		surface.kind,
		surface.x,
		surface.y,
		surface.cellSize,
		slot.x,
		slot.y,
	].join(":");

interface DrawDropFeedbackProps {
	readonly color: number;
	readonly graphics: Graphics;
	readonly slot: {
		readonly x: number;
		readonly y: number;
	} | null;
	readonly surface: SurfaceLayout | null;
}

const drawRoundedOuterSlotPathFn = (
	graphics: Graphics,
	surface: SurfaceLayout,
	slot: NonNullable<DrawDropFeedbackProps["slot"]>,
	radius: number,
) => {
	const left = surface.x + slot.x * surface.cellSize;
	const top = surface.y + slot.y * surface.cellSize;
	const right = left + surface.cellSize;
	const bottom = top + surface.cellSize;
	const topLeftRadius = slot.y === 0 && slot.x === 0 ? radius : 0;
	const topRightRadius = slot.y === 0 && slot.x === surface.columns - 1 ? radius : 0;
	const bottomRightRadius =
		slot.y === surface.rows - 1 && slot.x === surface.columns - 1 ? radius : 0;
	const bottomLeftRadius = slot.y === surface.rows - 1 && slot.x === 0 ? radius : 0;

	if (
		topLeftRadius === 0 &&
		topRightRadius === 0 &&
		bottomRightRadius === 0 &&
		bottomLeftRadius === 0
	) {
		return graphics.rect(left, top, surface.cellSize, surface.cellSize);
	}

	return graphics
		.moveTo(left + topLeftRadius, top)
		.lineTo(right - topRightRadius, top)
		.quadraticCurveTo(right, top, right, top + topRightRadius)
		.lineTo(right, bottom - bottomRightRadius)
		.quadraticCurveTo(right, bottom, right - bottomRightRadius, bottom)
		.lineTo(left + bottomLeftRadius, bottom)
		.quadraticCurveTo(left, bottom, left, bottom - bottomLeftRadius)
		.lineTo(left, top + topLeftRadius)
		.quadraticCurveTo(left, top, left + topLeftRadius, top)
		.closePath();
};

const drawDropFeedbackFx = Effect.fn("drawDropFeedbackFx")(function* ({
	color,
	graphics,
	slot,
	surface,
}: DrawDropFeedbackProps) {
	graphics.clear();
	if (slot === null || surface === null) return;
	const radius = readSurfaceRadiusFn(surface);
	drawRoundedOuterSlotPathFn(graphics, surface, slot, radius)
		.fill({
			alpha: 0.16,
			color,
		})
		.stroke({
			alpha: 0.95,
			color,
			width: Math.max(2, surface.cellSize * 0.025),
		});
});

/** Crossfades retained drop markers without delaying canonical hover targeting. */
export const createDropFeedbackFx = Effect.fn("createDropFeedbackFx")(
	({ animationDriver, label }: CreateDropFeedbackProps) =>
		Effect.sync((): DropFeedback => {
			const container = new Container({
				eventMode: "none",
				label,
			});
			const layers: [
				FeedbackLayer,
				FeedbackLayer,
			] = [
				{
					control: null,
					generation: 0,
					graphics: new Graphics({
						eventMode: "none",
						label: `${label}:0`,
					}),
				},
				{
					control: null,
					generation: 0,
					graphics: new Graphics({
						eventMode: "none",
						label: `${label}:1`,
					}),
				},
			];
			for (const layer of layers) {
				layer.graphics.alpha = 0;
				container.addChild(layer.graphics);
			}
			let closed = false;
			let currentIndex = 0;
			let currentKey: string | null = null;

			const stopLayerFx = (layer: FeedbackLayer) =>
				Effect.gen(function* () {
					layer.generation += 1;
					if (layer.control === null) return;
					const control = layer.control;
					layer.control = null;
					yield* control.stopFx;
				});

			const animateLayerFx = (
				layer: FeedbackLayer,
				to: number,
				durationMs: number,
				clearOnComplete: boolean,
			) =>
				Effect.gen(function* () {
					yield* stopLayerFx(layer);
					if (layer.graphics.alpha === to) {
						if (clearOnComplete) layer.graphics.clear();
						return;
					}
					const generation = ++layer.generation;
					let completedSynchronously = false;
					const control = yield* animationDriver.startTweenFx({
						durationMs,
						from: layer.graphics.alpha,
						onCompleteFn: () => {
							if (closed || layer.generation !== generation) return;
							completedSynchronously = true;
							layer.control = null;
							layer.graphics.alpha = to;
							if (clearOnComplete) layer.graphics.clear();
						},
						onUpdateFn: (alpha) => {
							if (closed || layer.generation !== generation) return;
							layer.graphics.alpha = alpha;
						},
						to,
					});
					if (!completedSynchronously) layer.control = control;
				});

			return {
				container,
				closeFx: Effect.gen(function* () {
					if (closed) return;
					closed = true;
					for (const layer of layers) yield* stopLayerFx(layer);
					if (!container.destroyed) {
						container.destroy({
							children: true,
						});
					}
				}),
				renderFx: Effect.fn("DropFeedback.renderFx")(({ color, slot, surface }) =>
					Effect.gen(function* () {
						if (closed) return;
						if (slot === null || surface === null) {
							currentKey = null;
							for (const layer of layers) {
								yield* animateLayerFx(layer, 0, exitDurationMs, true);
							}
							return;
						}

						const nextKey = readTargetKeyFn(color, slot, surface);
						const current = layers[currentIndex];
						if (currentKey === nextKey) {
							yield* drawDropFeedbackFx({
								color,
								graphics: current.graphics,
								slot,
								surface,
							});
							yield* animateLayerFx(current, 1, enterDurationMs, false);
							return;
						}

						const outgoing = current;
						currentIndex = currentIndex === 0 ? 1 : 0;
						const incoming = layers[currentIndex];
						currentKey = nextKey;
						yield* stopLayerFx(incoming);
						incoming.graphics.alpha = 0;
						yield* drawDropFeedbackFx({
							color,
							graphics: incoming.graphics,
							slot,
							surface,
						});
						container.addChild(incoming.graphics);
						yield* Effect.all(
							[
								animateLayerFx(outgoing, 0, exitDurationMs, true),
								animateLayerFx(incoming, 1, enterDurationMs, false),
							],
							{
								concurrency: "unbounded",
							},
						);
					}),
				),
			};
		}),
);
