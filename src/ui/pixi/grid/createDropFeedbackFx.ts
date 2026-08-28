import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type { AnimationControl, AnimationDriver } from "~/ui/pixi/animation/AnimationDriver";
import type { DropFeedback } from "~/ui/pixi/grid/DropFeedback";
import { drawDropFeedbackFx } from "~/ui/pixi/grid/drawDropFeedbackFx";
import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

export namespace createDropFeedbackFx {
	export interface Props {
		readonly animationDriver: AnimationDriver;
		readonly label: string;
	}
}

interface FeedbackLayer {
	control: AnimationControl | null;
	generation: number;
	readonly graphics: Graphics;
}

const enterDurationMs = 130;
const exitDurationMs = 180;

const readTargetKey = (
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

/** Crossfades retained drop markers without delaying canonical hover targeting. */
export const createDropFeedbackFx = Effect.fn("createDropFeedbackFx")(
	({ animationDriver, label }: createDropFeedbackFx.Props) =>
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

						const nextKey = readTargetKey(color, slot, surface);
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
