import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type {
	PresentationRuntime,
	PresentationTarget,
} from "~/game-scene/service/PresentationRuntime";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { AnimationControl, AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { createRetargetablePoseSamplerFx } from "~/tile-rendering/fx/createRetargetablePoseSamplerFx";
import { whenVisualReadyFx } from "~/tile-rendering/fx/whenVisualReadyFx";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";

interface Props {
	readonly animator: ActorAnimator;
	readonly animationDriver: AnimationDriver;
	readonly frames: DemandFrameLoop;
	readonly surface: MainSurface;
}

interface ActiveActorRequest {
	readonly actors: readonly PixiTileActor[];
	readonly keys: readonly string[];
	readonly slots: readonly string[];
	onRetireFn?: () => void;
}

const enterDurationMs = 160;
const exitDurationMs = 130;
const crossfadeDurationMs = 170;
const boardDurationMs = 155;
const boardOffsetPx = 40;

/** One owner for replaceable gameplay feedback; rendering and engine truth stay elsewhere. */
export const createPresentationRuntimeFx = Effect.fn("createPresentationRuntimeFx")(
	({ animator, animationDriver, frames, surface }: Props) =>
		Effect.sync((): PresentationRuntime => {
			const activeBySlot = new Map<string, ActiveActorRequest>();
			let nextGeneration = 0;
			let boardGeneration = 0;
			let boardControl: AnimationControl | null = null;
			let closed = false;

			const slotFn = (actor: PixiTileActor, kind: "lifecycle" | "pose") =>
				`${actor.instanceId}:${kind}`;
			const ownsFn = (request: ActiveActorRequest) =>
				!closed && request.slots.every((slot) => activeBySlot.get(slot) === request);
			const releaseFn = (request: ActiveActorRequest) => {
				for (const slot of request.slots) {
					if (activeBySlot.get(slot) === request) activeBySlot.delete(slot);
				}
			};
			const retireFx = Effect.fn("PresentationRuntime.retireFx")(function* (
				request: ActiveActorRequest,
			) {
				releaseFn(request);
				for (const key of request.keys) yield* animator.cancelFx(key);
				request.onRetireFn?.();
			});
			const beginFx = Effect.fn("PresentationRuntime.beginFx")(function* (
				claims: readonly {
					actor: PixiTileActor;
					kind: "lifecycle" | "pose";
				}[],
				channels: number,
			) {
				if (closed || claims.some(({ actor }) => actor.container.destroyed)) return null;
				const slots = claims.map(({ actor, kind }) => slotFn(actor, kind));
				for (const previous of new Set(slots.map((slot) => activeBySlot.get(slot)))) {
					if (previous !== undefined) yield* retireFx(previous);
				}
				const generation = ++nextGeneration;
				const request: ActiveActorRequest = {
					actors: claims.map(({ actor }) => actor),
					keys: Array.from(
						{
							length: channels,
						},
						(_, index) => `presentation:${generation}:${index}`,
					),
					slots,
				};
				for (const slot of slots) activeBySlot.set(slot, request);
				return request;
			});
			const completeFn = (request: ActiveActorRequest, onCompleteFn?: () => void) => {
				if (!ownsFn(request)) return;
				releaseFn(request);
				onCompleteFn?.();
			};
			const startWhenReadyFx = Effect.fn("PresentationRuntime.startWhenReadyFx")(function* (
				request: ActiveActorRequest,
				actor: PixiTileActor,
				startFx: () => Effect.Effect<void>,
			) {
				const visual = actor.pendingVisual ?? actor.currentVisual;
				const continueFn = () => {
					if (!ownsFn(request) || actor.container.destroyed) return;
					if ((actor.pendingVisual ?? actor.currentVisual) !== visual) {
						RendererRuntime.runSync(startWhenReadyFx(request, actor, startFx));
						return;
					}
					RendererRuntime.runSync(startFx());
				};
				if (visual.textureState === "ready") {
					continueFn();
					return;
				}
				yield* whenVisualReadyFx({
					visual,
					onReadyFn: continueFn,
					onCancelFn: () => {
						if (!ownsFn(request) || actor.container.destroyed) return;
						if ((actor.pendingVisual ?? actor.currentVisual) !== visual) {
							RendererRuntime.runSync(startWhenReadyFx(request, actor, startFx));
						} else RendererRuntime.runSync(retireFx(request));
					},
				});
			});
			const stopBoardFx = Effect.sync(() => {
				boardGeneration += 1;
				if (boardControl !== null) RendererRuntime.runSync(boardControl.stopFx);
				boardControl = null;
			});
			const animateBoardFx = Effect.fn("PresentationRuntime.animateBoardFx")(function* ({
				entering,
				onCompleteFn,
			}: {
				readonly entering: boolean;
				readonly onCompleteFn: () => void;
			}) {
				if (closed || surface.boardPresentationLayer.destroyed) return;
				yield* stopBoardFx;
				const layer = surface.boardPresentationLayer;
				if (entering) {
					layer.alpha = 0;
					layer.y = -boardOffsetPx;
				}
				const fromAlpha = layer.alpha;
				const fromY = layer.y;
				const toAlpha = entering ? 1 : 0;
				const toY = entering ? 0 : boardOffsetPx;
				const generation = boardGeneration;
				boardControl = yield* animationDriver.startTweenFx({
					durationMs: boardDurationMs,
					from: 0,
					onCompleteFn: () => {
						if (closed || generation !== boardGeneration || layer.destroyed) return;
						boardControl = null;
						layer.alpha = toAlpha;
						layer.y = toY;
						onCompleteFn();
					},
					onUpdateFn: (progress) => {
						if (closed || generation !== boardGeneration || layer.destroyed) return;
						layer.alpha = fromAlpha + (toAlpha - fromAlpha) * progress;
						layer.y = fromY + (toY - fromY) * progress;
					},
					to: 1,
				});
				yield* frames.invalidateFx;
			});

			return {
				appearFx: Effect.fn("PresentationRuntime.appearFx")(function* ({
					actor,
					delayMs,
					initial,
					onCompleteFn,
				}) {
					const request = yield* beginFx(
						[
							{
								actor,
								kind: "lifecycle",
							},
						],
						2,
					);
					if (request === null) return;
					actor.container.eventMode = "none";
					if (initial) {
						yield* animator.setFx({
							actor,
							channel: "lifecycle-opacity",
							alpha: 0,
						});
						yield* animator.setFx({
							actor,
							channel: "lifecycle-scale",
							scale: 0.8,
						});
					}
					yield* startWhenReadyFx(request, actor, () =>
						Effect.gen(function* () {
							let completeChannels = 0;
							const finishFn = () => {
								if (++completeChannels !== 2 || !ownsFn(request)) return;
								actor.container.eventMode = "static";
								completeFn(request, onCompleteFn);
							};
							yield* animator.animateFx({
								actor,
								channel: "lifecycle-opacity",
								delayMs,
								durationMs: enterDurationMs,
								onCompleteFn: finishFn,
								ownerKey: request.keys[0],
								toAlpha: 1,
							});
							yield* animator.animateFx({
								actor,
								channel: "lifecycle-scale",
								delayMs,
								durationMs: enterDurationMs,
								onCompleteFn: finishFn,
								ownerKey: request.keys[1],
								toScale: 1,
							});
						}),
					);
				}),
				disappearFx: Effect.fn("PresentationRuntime.disappearFx")(function* ({
					actor,
					onCompleteFn,
				}) {
					const request = yield* beginFx(
						[
							{
								actor,
								kind: "lifecycle",
							},
						],
						2,
					);
					if (request === null) return;
					actor.container.eventMode = "none";
					let completeChannels = 0;
					const finishFn = () => {
						if (++completeChannels === 2) completeFn(request, onCompleteFn);
					};
					yield* animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						durationMs: exitDurationMs,
						onCompleteFn: finishFn,
						ownerKey: request.keys[0],
						toAlpha: 0,
					});
					yield* animator.animateFx({
						actor,
						channel: "lifecycle-scale",
						durationMs: exitDurationMs,
						onCompleteFn: finishFn,
						ownerKey: request.keys[1],
						toScale: 0.8,
					});
				}),
				crossfadeFx: Effect.fn("PresentationRuntime.crossfadeFx")(function* ({
					incoming,
					initialIncoming,
					outgoing,
					onCompleteFn,
				}) {
					if (incoming === outgoing) {
						onCompleteFn?.();
						return;
					}
					const request = yield* beginFx(
						[
							{
								actor: incoming,
								kind: "lifecycle",
							},
							{
								actor: outgoing,
								kind: "lifecycle",
							},
						],
						2,
					);
					if (request === null) return;
					// An interrupted crossfade still has to retire its outgoing actor.
					request.onRetireFn = onCompleteFn;
					incoming.container.eventMode = "none";
					if (initialIncoming) {
						yield* animator.setFx({
							actor: incoming,
							channel: "lifecycle-opacity",
							alpha: 0,
						});
					}
					yield* startWhenReadyFx(request, incoming, () =>
						Effect.gen(function* () {
							let completeChannels = 0;
							const finishFn = () => {
								if (++completeChannels !== 2 || !ownsFn(request)) return;
								incoming.container.eventMode = "static";
								completeFn(request, onCompleteFn);
							};
							yield* animator.animateFx({
								actor: incoming,
								channel: "lifecycle-opacity",
								durationMs: crossfadeDurationMs,
								onCompleteFn: finishFn,
								ownerKey: request.keys[0],
								toAlpha: 1,
							});
							yield* animator.animateFx({
								actor: outgoing,
								channel: "lifecycle-opacity",
								durationMs: crossfadeDurationMs,
								onCompleteFn: finishFn,
								ownerKey: request.keys[1],
								toAlpha: 0,
							});
						}),
					);
				}),
				travelFx: Effect.fn("PresentationRuntime.travelFx")(function* ({
					actor,
					onCompleteFn,
					readTargetFn,
					target,
				}) {
					const request = yield* beginFx(
						[
							{
								actor,
								kind: "pose",
							},
						],
						1,
					);
					if (request === null) return;
					const readPoseFn = (): PresentationTarget & {
						readonly scale: number;
					} => {
						const latest = readTargetFn() ?? target;
						return {
							scale: latest.size / Math.max(1, actor.size),
							x: latest.x,
							y: latest.y,
							size: latest.size,
						};
					};
					const startTravelFx = Effect.fn("PresentationRuntime.startTravelFx")(
						function* () {
							if (!ownsFn(request) || actor.container.destroyed) return;
							const destination = readPoseFn();
							const from = {
								scale: actor.container.scale.x,
								x: actor.container.x,
								y: actor.container.y,
							};
							if (
								from.x === destination.x &&
								from.y === destination.y &&
								from.scale === destination.scale
							) {
								completeFn(request, onCompleteFn);
								return;
							}
							const sampleFn = yield* createRetargetablePoseSamplerFx({
								from,
								readTargetFn: readPoseFn,
							});
							yield* animator.animateFx({
								actor,
								channel: "pose",
								durationMs: Math.max(
									180,
									readTravelDurationMsFn({
										fromX: from.x,
										fromY: from.y,
										tileSize: destination.size,
										toX: destination.x,
										toY: destination.y,
									}),
								),
								onCompleteFn: () => {
									if (!ownsFn(request)) return;
									const latest = readPoseFn();
									if (
										Math.hypot(
											actor.container.x - latest.x,
											actor.container.y - latest.y,
										) < 0.25 &&
										Math.abs(actor.container.scale.x - latest.scale) < 0.001
									) {
										RendererRuntime.runSync(
											animator.setFx({
												actor,
												channel: "pose",
												scale: latest.scale,
												x: latest.x,
												y: latest.y,
											}),
										);
										completeFn(request, onCompleteFn);
										return;
									}
									RendererRuntime.runSync(startTravelFx());
								},
								ownerKey: request.keys[0],
								readPoseFn: sampleFn,
							});
						},
					);
					yield* startWhenReadyFx(request, actor, startTravelFx);
				}),
				exitBoardFx: (onCompleteFn) =>
					animateBoardFx({
						entering: false,
						onCompleteFn,
					}),
				enterBoardFx: (onCompleteFn) =>
					animateBoardFx({
						entering: true,
						onCompleteFn,
					}),
				cancelActorFx: Effect.fn("PresentationRuntime.cancelActorFx")(function* (actor) {
					for (const request of new Set(activeBySlot.values())) {
						if (request.actors.includes(actor)) yield* retireFx(request);
					}
				}),
				isTravelingFx: Effect.fn("PresentationRuntime.isTravelingFx")((actor) =>
					Effect.sync(() => activeBySlot.has(slotFn(actor, "pose"))),
				),
				cancelAllFx: Effect.gen(function* () {
					for (const request of new Set(activeBySlot.values())) yield* retireFx(request);
					yield* stopBoardFx;
				}),
				closeFx: Effect.gen(function* () {
					if (closed) return;
					closed = true;
					for (const request of new Set(activeBySlot.values())) yield* retireFx(request);
					yield* stopBoardFx;
				}),
			};
		}),
);
