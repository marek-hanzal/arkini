import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { AnimationControl, AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type {
	ActorAnimation,
	AnimationChannel,
	ActorAnimator,
	PresentationWrite,
} from "~/tile-rendering/service/ActorAnimator";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export namespace createActorAnimatorFx {
	export interface Props {
		readonly animationDriver: AnimationDriver;
		readonly frames: DemandFrameLoop;
	}
}

interface ActiveAnimation {
	readonly actor: PixiTileActor;
	readonly channel: AnimationChannel;
	readonly onCancelFn?: () => void;
	readonly ownerKey: string;
	control: AnimationControl | null;
}

/**
 * The sole writer for animated tile channels.
 *
 * Physical ownership is keyed by actor instance and typed channel. Caller owner keys only allow a
 * lifecycle scope to cancel its own work; two different owner keys can never write one channel.
 */
export const createActorAnimatorFx = Effect.fn("createActorAnimatorFx")(
	({ animationDriver, frames }: createActorAnimatorFx.Props) =>
		Effect.sync((): ActorAnimator => {
			const activeAnimations = new Set<ActiveAnimation>();
			const animationsByOwner = new Map<string, ActiveAnimation>();
			const channelsByActor = new WeakMap<
				PixiTileActor,
				Map<AnimationChannel, ActiveAnimation>
			>();
			let closed = false;

			const readActorChannelsFn = (actor: PixiTileActor) => {
				const existing = channelsByActor.get(actor);
				if (existing !== undefined) return existing;
				const created = new Map<AnimationChannel, ActiveAnimation>();
				channelsByActor.set(actor, created);
				return created;
			};

			const releaseFn = (animation: ActiveAnimation) => {
				activeAnimations.delete(animation);
				if (animationsByOwner.get(animation.ownerKey) === animation) {
					animationsByOwner.delete(animation.ownerKey);
				}
				const channels = channelsByActor.get(animation.actor);
				if (channels?.get(animation.channel) === animation) {
					channels.delete(animation.channel);
				}
			};

			const cancelFn = (animation: ActiveAnimation | undefined) => {
				if (animation === undefined) return;
				releaseFn(animation);
				if (animation.control !== null) RendererRuntime.runSync(animation.control.stopFx);
				animation.onCancelFn?.();
			};

			const cancelChannelFn = (actor: PixiTileActor, channel: AnimationChannel) => {
				cancelFn(channelsByActor.get(actor)?.get(channel));
			};

			const applyWriteFn = (write: PresentationWrite) => {
				if (write.actor.container.destroyed) return;
				switch (write.channel) {
					case "activity-particles":
						if (write.reset) {
							for (const { particle } of write.actor.activityParticles.particles) {
								particle.alpha = 0;
							}
						}
						write.actor.activityParticles.container.visible = write.visible;
						break;
					case "pose":
						write.actor.container.x = write.x;
						write.actor.container.y = write.y;
						if (write.scale !== undefined) write.actor.container.scale.set(write.scale);
						break;
					case "lifecycle-opacity":
						write.actor.container.alpha = write.alpha;
						break;
					case "lifecycle-scale":
						write.actor.lifecycleLayer.scale.set(write.scale);
						break;
					case "crowd-opacity":
						write.actor.crowdLayer.alpha = write.alpha;
						break;
					case "grab-offset":
						write.actor.container.pivot.set(write.pivotX, write.pivotY);
						break;
				}
			};

			const animateFx = Effect.fn("ActorAnimator.animateFx")((animation: ActorAnimation) =>
				Effect.sync(() => {
					if (closed) return;
					const { actor, channel } = animation;
					if (actor.container.destroyed) return;
					const ownerKey =
						animation.ownerKey ?? `${actor.instanceId ?? actor.item.id}:${channel}`;
					cancelChannelFn(actor, channel);
					cancelFn(animationsByOwner.get(ownerKey));
					// Cancellation callbacks are allowed to retire the actor synchronously. Pixi
					// destroys its transform internals at that point, so even reading the old pose
					// would be a use-after-destroy.
					if (closed || actor.container.destroyed) return;

					const fromX = actor.container.x;
					const fromY = actor.container.y;
					const fromScale = actor.container.scale.x;
					const fromAlpha = actor.container.alpha;
					const fromLifecycleScale = actor.lifecycleLayer.scale.x;
					const fromCrowdAlpha = actor.crowdLayer.alpha;
					const fromIncomingAlpha =
						animation.channel === "visual-mix" ? animation.incoming.alpha : 0;
					const fromOutgoingAlpha =
						animation.channel === "visual-mix" ? animation.outgoing.alpha : 0;
					const active: ActiveAnimation = {
						actor,
						channel,
						onCancelFn: animation.onCancelFn,
						ownerKey,
						control: null,
					};
					activeAnimations.add(active);
					animationsByOwner.set(ownerKey, active);
					readActorChannelsFn(actor).set(channel, active);

					try {
						active.control = RendererRuntime.runSync(
							animationDriver.startTweenFx({
								curve: animation.curve,
								delayMs: animation.delayMs,
								durationMs: animation.durationMs,
								from: 0,
								onUpdateFn: (progress) => {
									if (closed || actor.container.destroyed) return;
									switch (animation.channel) {
										case "activity-particles":
											animation.renderFn(progress);
											break;
										case "pose": {
											const pose = animation.readPoseFn?.(progress);
											actor.container.x =
												pose?.x ??
												fromX +
													((animation.toX ?? fromX) - fromX) * progress;
											actor.container.y =
												pose?.y ??
												fromY +
													((animation.toY ?? fromY) - fromY) * progress;
											const scale =
												pose?.scale ??
												fromScale +
													((animation.toScale ?? fromScale) - fromScale) *
														progress;
											actor.container.scale.set(scale);
											break;
										}
										case "lifecycle-opacity":
											actor.container.alpha =
												fromAlpha +
												(animation.toAlpha - fromAlpha) * progress;
											break;
										case "lifecycle-scale":
											actor.lifecycleLayer.scale.set(
												fromLifecycleScale +
													(animation.toScale - fromLifecycleScale) *
														progress,
											);
											break;
										case "crowd-opacity":
											actor.crowdLayer.alpha =
												fromCrowdAlpha +
												(animation.toCrowdAlpha - fromCrowdAlpha) *
													progress;
											break;
										case "visual-mix":
											animation.incoming.alpha =
												fromIncomingAlpha +
												(1 - fromIncomingAlpha) * progress;
											animation.outgoing.alpha =
												fromOutgoingAlpha * (1 - progress);
											break;
									}
								},
								onCompleteFn: () => {
									if (
										channelsByActor.get(actor)?.get(channel) !== active ||
										animationsByOwner.get(ownerKey) !== active
									) {
										return;
									}
									releaseFn(active);
									animation.onCompleteFn?.();
								},
								repeat: animation.repeat,
								to: 1,
							}),
						);
					} catch (cause) {
						releaseFn(active);
						throw cause;
					}
				}),
			);

			return {
				animateFx,
				cancelActorFx: Effect.fn("ActorAnimator.cancelActorFx")((actor) =>
					Effect.sync(() => {
						for (const animation of [
							...(channelsByActor.get(actor)?.values() ?? []),
						]) {
							cancelFn(animation);
						}
					}),
				),
				cancelChannelFx: Effect.fn("ActorAnimator.cancelChannelFx")((actor, channel) =>
					Effect.sync(() => cancelChannelFn(actor, channel)),
				),
				cancelFx: Effect.fn("ActorAnimator.cancelFx")((ownerKey) =>
					Effect.sync(() => cancelFn(animationsByOwner.get(ownerKey))),
				),
				isChannelActiveFx: Effect.fn("ActorAnimator.isChannelActiveFx")((actor, channel) =>
					Effect.sync(() => channelsByActor.get(actor)?.has(channel) === true),
				),
				setFx: Effect.fn("ActorAnimator.setFx")((write) =>
					Effect.gen(function* () {
						cancelChannelFn(write.actor, write.channel);
						applyWriteFn(write);
						yield* frames.invalidateFx;
					}),
				),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					const failures: unknown[] = [];
					for (const animation of [
						...activeAnimations,
					]) {
						try {
							cancelFn(animation);
						} catch (cause) {
							failures.push(cause);
						}
					}
					activeAnimations.clear();
					animationsByOwner.clear();
					if (failures.length > 0) {
						throw new AggregateError(failures, "Pixi actor animation cleanup failed.");
					}
				}),
			};
		}),
);
