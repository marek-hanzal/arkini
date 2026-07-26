import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationControl,
	PixiAnimationDriver,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type {
	PixiActorAnimation,
	PixiActorAnimationChannel,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiActorAnimatorFx {
	export interface Props {
		readonly animationDriver: PixiAnimationDriver;
		readonly frames: DemandFrameLoop;
	}
}

interface ActiveAnimation {
	readonly actor: PixiTileActor;
	readonly channel: PixiActorAnimationChannel;
	readonly ownerKey: string;
	control: PixiAnimationControl | null;
}

/**
 * The sole writer for animated tile channels.
 *
 * Physical ownership is keyed by actor instance and typed channel. Caller owner keys only allow a
 * lifecycle scope to cancel its own work; two different owner keys can never write one channel.
 */
export const createPixiActorAnimatorFx = Effect.fn("createPixiActorAnimatorFx")(
	({ animationDriver, frames }: createPixiActorAnimatorFx.Props) =>
		Effect.sync((): PixiActorAnimator => {
			const activeAnimations = new Set<ActiveAnimation>();
			const animationsByOwner = new Map<string, ActiveAnimation>();
			const channelsByActor = new WeakMap<
				PixiTileActor,
				Map<PixiActorAnimationChannel, ActiveAnimation>
			>();
			let closed = false;

			const readActorChannels = (actor: PixiTileActor) => {
				const existing = channelsByActor.get(actor);
				if (existing !== undefined) return existing;
				const created = new Map<PixiActorAnimationChannel, ActiveAnimation>();
				channelsByActor.set(actor, created);
				return created;
			};

			const release = (animation: ActiveAnimation) => {
				activeAnimations.delete(animation);
				if (animationsByOwner.get(animation.ownerKey) === animation) {
					animationsByOwner.delete(animation.ownerKey);
				}
				const channels = channelsByActor.get(animation.actor);
				if (channels?.get(animation.channel) === animation) {
					channels.delete(animation.channel);
				}
			};

			const cancel = (animation: ActiveAnimation | undefined) => {
				if (animation === undefined) return;
				release(animation);
				if (animation.control !== null) RendererRuntime.runSync(animation.control.stopFx);
			};

			const cancelChannel = (actor: PixiTileActor, channel: PixiActorAnimationChannel) => {
				cancel(channelsByActor.get(actor)?.get(channel));
			};

			const applyWrite = (write: PixiActorPresentationWrite) => {
				if (write.actor.container.destroyed) return;
				switch (write.channel) {
					case "pose":
						write.actor.container.x = write.x;
						write.actor.container.y = write.y;
						if (write.scale !== undefined) write.actor.container.scale.set(write.scale);
						break;
					case "lifecycle-opacity":
						write.actor.container.alpha = write.alpha;
						break;
					case "crowd-opacity":
						write.actor.crowdLayer.alpha = write.alpha;
						break;
					case "grab-offset":
						write.actor.container.pivot.set(write.pivotX, write.pivotY);
						break;
					case "glow-opacity":
						if (write.alpha !== undefined) write.actor.runningGlow.alpha = write.alpha;
						if (write.visible !== undefined)
							write.actor.runningGlow.visible = write.visible;
						break;
				}
			};

			const animateFx = Effect.fn("PixiActorAnimator.animateFx")(
				(animation: PixiActorAnimation) =>
					Effect.sync(() => {
						if (closed) return;
						const { actor, channel } = animation;
						const ownerKey =
							animation.ownerKey ?? `${actor.instanceId ?? actor.item.id}:${channel}`;
						cancelChannel(actor, channel);
						cancel(animationsByOwner.get(ownerKey));

						const fromX = actor.container.x;
						const fromY = actor.container.y;
						const fromScale = actor.container.scale.x;
						const fromAlpha = actor.container.alpha;
						const fromCrowdAlpha = actor.crowdLayer.alpha;
						const fromGlowAlpha = actor.runningGlow.alpha;
						const fromIncomingAlpha =
							animation.channel === "visual-mix" ? animation.incoming.alpha : 0;
						const fromOutgoingAlpha =
							animation.channel === "visual-mix" ? animation.outgoing.alpha : 0;
						const active: ActiveAnimation = {
							actor,
							channel,
							ownerKey,
							control: null,
						};
						activeAnimations.add(active);
						animationsByOwner.set(ownerKey, active);
						readActorChannels(actor).set(channel, active);

						try {
							active.control = RendererRuntime.runSync(
								animationDriver.startTweenFx({
									delayMs: animation.delayMs,
									durationMs: animation.durationMs,
									from: 0,
									onUpdate: (progress) => {
										if (closed || actor.container.destroyed) return;
										switch (animation.channel) {
											case "pose": {
												const pose = animation.readPose?.(progress);
												actor.container.x =
													pose?.x ??
													fromX +
														((animation.toX ?? fromX) - fromX) *
															progress;
												actor.container.y =
													pose?.y ??
													fromY +
														((animation.toY ?? fromY) - fromY) *
															progress;
												const scale =
													pose?.scale ??
													fromScale +
														((animation.toScale ?? fromScale) -
															fromScale) *
															progress;
												actor.container.scale.set(scale);
												break;
											}
											case "lifecycle-opacity":
												actor.container.alpha =
													fromAlpha +
													(animation.toAlpha - fromAlpha) * progress;
												break;
											case "crowd-opacity":
												actor.crowdLayer.alpha =
													fromCrowdAlpha +
													(animation.toCrowdAlpha - fromCrowdAlpha) *
														progress;
												break;
											case "glow-opacity":
												actor.runningGlow.alpha =
													fromGlowAlpha +
													(animation.toRunningGlowAlpha - fromGlowAlpha) *
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
									onComplete: () => {
										if (
											channelsByActor.get(actor)?.get(channel) !== active ||
											animationsByOwner.get(ownerKey) !== active
										) {
											return;
										}
										release(active);
										animation.onComplete?.();
									},
									to: 1,
								}),
							);
						} catch (cause) {
							release(active);
							throw cause;
						}
					}),
			);

			return {
				animateFx,
				cancelActorFx: Effect.fn("PixiActorAnimator.cancelActorFx")((actor) =>
					Effect.sync(() => {
						for (const animation of [
							...(channelsByActor.get(actor)?.values() ?? []),
						]) {
							cancel(animation);
						}
					}),
				),
				cancelChannelFx: Effect.fn("PixiActorAnimator.cancelChannelFx")((actor, channel) =>
					Effect.sync(() => cancelChannel(actor, channel)),
				),
				cancelFx: Effect.fn("PixiActorAnimator.cancelFx")((ownerKey) =>
					Effect.sync(() => cancel(animationsByOwner.get(ownerKey))),
				),
				setFx: Effect.fn("PixiActorAnimator.setFx")((write) =>
					Effect.gen(function* () {
						cancelChannel(write.actor, write.channel);
						applyWrite(write);
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
							cancel(animation);
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
