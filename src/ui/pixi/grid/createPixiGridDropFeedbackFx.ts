import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type {
	PixiAnimationControl,
	PixiAnimationDriver,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type { PixiGridDropFeedback } from "~/ui/pixi/grid/PixiGridDropFeedback";
import { drawPixiGridDropFeedbackFx } from "~/ui/pixi/grid/drawPixiGridDropFeedbackFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace createPixiGridDropFeedbackFx {
	export interface Props {
		readonly animationDriver: PixiAnimationDriver;
		readonly label: string;
	}
}

interface FeedbackLayer {
	control: PixiAnimationControl | null;
	generation: number;
	readonly graphics: Graphics;
}

const enterDurationMs = 130;
const exitDurationMs = 180;

const readTargetKey = (
	color: number,
	markers: Parameters<PixiGridDropFeedback["renderFx"]>[0]["markers"],
	slot: NonNullable<Parameters<PixiGridDropFeedback["renderFx"]>[0]["slot"]>,
	surface: PixiGridSurfaceLayout,
) =>
	[
		color,
		surface.kind,
		surface.x,
		surface.y,
		surface.cellSize,
		slot.x,
		slot.y,
		slot.width ?? 1,
		slot.height ?? 1,
		...(markers ?? []).flatMap(({ color: markerColor, slot: markerSlot }) => [
			markerColor,
			markerSlot.x,
			markerSlot.y,
			markerSlot.width ?? 1,
			markerSlot.height ?? 1,
		]),
	].join(":");

/** Crossfades retained drop markers without delaying canonical hover targeting. */
export const createPixiGridDropFeedbackFx = Effect.fn("createPixiGridDropFeedbackFx")(
	({ animationDriver, label }: createPixiGridDropFeedbackFx.Props) =>
		Effect.sync((): PixiGridDropFeedback => {
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
						onComplete: () => {
							if (closed || layer.generation !== generation) return;
							completedSynchronously = true;
							layer.control = null;
							layer.graphics.alpha = to;
							if (clearOnComplete) layer.graphics.clear();
						},
						onUpdate: (alpha) => {
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
				renderFx: Effect.fn("PixiGridDropFeedback.renderFx")(
					({ color, markers, slot, surface }) =>
						Effect.gen(function* () {
							if (closed) return;
							if (slot === null || surface === null) {
								currentKey = null;
								for (const layer of layers) {
									yield* animateLayerFx(layer, 0, exitDurationMs, true);
								}
								return;
							}

							const nextKey = readTargetKey(color, markers, slot, surface);
							const current = layers[currentIndex];
							if (currentKey === nextKey) {
								yield* drawPixiGridDropFeedbackFx({
									color,
									graphics: current.graphics,
									markers,
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
							yield* drawPixiGridDropFeedbackFx({
								color,
								graphics: incoming.graphics,
								markers,
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
