// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createPresentationRuntimeFx } from "~/game-scene/fx/createPresentationRuntimeFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";

const harness = () => {
	const tweens: Array<{
		completeFn: () => void;
		readonly stopped: ReturnType<typeof vi.fn>;
		updateFn: (progress: number) => void;
	}> = [];
	const frames = {
		invalidateFx: Effect.void,
	} as DemandFrameLoop;
	const animationDriver = {
		startTweenFx: (props: Parameters<AnimationDriver["startTweenFx"]>[0]) =>
			Effect.sync(() => {
				let active = true;
				const stopped = vi.fn(() => {
					active = false;
				});
				tweens.push({
					completeFn: () => {
						if (!active) return;
						active = false;
						props.onCompleteFn?.();
					},
					stopped,
					updateFn: (progress) => {
						if (active) props.onUpdateFn(progress);
					},
				});
				return {
					stopFx: Effect.sync(stopped),
				};
			}),
	} as AnimationDriver;
	const animator = Effect.runSync(
		createActorAnimatorFx({
			animationDriver,
			frames,
		}),
	);
	const boardPresentationLayer = new Container();
	const surface = {
		boardPresentationLayer,
	} as MainSurface;
	const presentation = Effect.runSync(
		createPresentationRuntimeFx({
			animator,
			animationDriver,
			frames,
			surface,
		}),
	);
	const createActor = (id: string, ready = true): PixiTileActor => {
		const container = new Container();
		container.position.set(0, 0);
		const lifecycleLayer = new Container();
		const visualLayer = new Container();
		container.addChild(lifecycleLayer);
		lifecycleLayer.addChild(visualLayer);
		const currentVisual = {
			readyListeners: new Set(),
			textureGeneration: 0,
			textureState: ready ? "ready" : "loading",
		} as ActorVisual;
		return {
			container,
			currentVisual,
			lifecycleLayer,
			visualLayer,
			crowdLayer: new Container(),
			instanceId: id,
			item: {
				id,
			},
			size: 100,
		} as PixiTileActor;
	};
	return {
		boardPresentationLayer,
		createActor,
		presentation,
		tweens,
	};
};

describe("scene presentation requests", () => {
	it("rebinds a pending pop to a newer visual instead of revealing the old artwork", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:revision-pop", false);
		const oldVisual = actor.currentVisual;
		Effect.runSync(
			scene.presentation.appearFx({
				actor,
				initial: true,
			}),
		);
		const replacement = {
			...oldVisual,
			readyListeners: new Set(),
			textureState: "loading",
		} as ActorVisual;
		actor.pendingVisual = replacement;
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: oldVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(0);
		actor.currentVisual = replacement;
		actor.pendingVisual = null;
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: replacement,
			}),
		);
		expect(scene.tweens).toHaveLength(2);
		scene.tweens[0]?.completeFn();
		scene.tweens[1]?.completeFn();
		expect(actor.container.eventMode).toBe("static");
	});

	it("retains the outgoing actor when an initial crossfade visual is replaced", () => {
		const scene = harness();
		const outgoing = scene.createActor("runtime:revision-outgoing");
		const incoming = scene.createActor("runtime:revision-incoming", false);
		const oldVisual = incoming.currentVisual;
		const completed = vi.fn();
		Effect.runSync(
			scene.presentation.crossfadeFx({
				incoming,
				initialIncoming: true,
				outgoing,
				onCompleteFn: completed,
			}),
		);
		const replacement = {
			...oldVisual,
			readyListeners: new Set(),
			textureState: "ready",
		} as ActorVisual;
		incoming.currentVisual = replacement;
		Effect.runSync(
			runVisualReadinessFx({
				kind: "cancel",
				visual: oldVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(2);
		expect(outgoing.container.alpha).toBe(1);
		expect(completed).not.toHaveBeenCalled();
		scene.tweens[0]?.completeFn();
		scene.tweens[1]?.completeFn();
		expect(completed).toHaveBeenCalledOnce();
		expect(incoming.container.eventMode).toBe("static");
	});

	it("starts the pop only after the artwork is ready and admits hits after landing", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:loading", false);
		actor.container.eventMode = "static";
		Effect.runSync(
			scene.presentation.appearFx({
				actor,
				initial: true,
			}),
		);
		expect(actor.container.alpha).toBe(0);
		expect(actor.lifecycleLayer.scale.x).toBe(0.8);
		expect(actor.container.eventMode).toBe("none");
		expect(scene.tweens).toHaveLength(0);

		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: actor.currentVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(2);
		scene.tweens[0]?.completeFn();
		expect(actor.container.eventMode).toBe("none");
		scene.tweens[1]?.completeFn();
		expect(actor.container.eventMode).toBe("static");
	});

	it("keeps the outgoing actor visible until the incoming artwork is ready", () => {
		const scene = harness();
		const outgoing = scene.createActor("runtime:outgoing");
		const incoming = scene.createActor("runtime:loading-replacement", false);
		incoming.container.eventMode = "static";
		const completed = vi.fn();
		Effect.runSync(
			scene.presentation.crossfadeFx({
				incoming,
				initialIncoming: true,
				outgoing,
				onCompleteFn: completed,
			}),
		);
		expect(scene.tweens).toHaveLength(0);
		expect(outgoing.container.alpha).toBe(1);
		expect(incoming.container.alpha).toBe(0);
		expect(incoming.container.eventMode).toBe("none");
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: incoming.currentVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(2);
		scene.tweens[0]?.completeFn();
		scene.tweens[1]?.completeFn();
		expect(incoming.container.eventMode).toBe("static");
		expect(completed).toHaveBeenCalledOnce();
	});

	it("ignores late artwork readiness after an appearance is canceled", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:canceled", false);
		Effect.runSync(
			scene.presentation.appearFx({
				actor,
				initial: true,
			}),
		);
		Effect.runSync(scene.presentation.cancelActorFx(actor));
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: actor.currentVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(0);
		expect(actor.container.eventMode).toBe("none");
	});

	it("retires the old outgoing actor when a crossfade is superseded", () => {
		const scene = harness();
		const first = scene.createActor("runtime:first");
		const second = scene.createActor("runtime:second");
		const third = scene.createActor("runtime:third");
		const retireFirst = vi.fn();
		Effect.runSync(
			scene.presentation.crossfadeFx({
				incoming: second,
				initialIncoming: true,
				outgoing: first,
				onCompleteFn: retireFirst,
			}),
		);
		Effect.runSync(
			scene.presentation.crossfadeFx({
				incoming: third,
				initialIncoming: true,
				outgoing: second,
			}),
		);
		expect(retireFirst).toHaveBeenCalledOnce();
		scene.tweens[0]?.completeFn();
		scene.tweens[1]?.completeFn();
		expect(retireFirst).toHaveBeenCalledOnce();
	});

	it("replaces a running actor exit and ignores its stale completion", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:actor");
		const oldComplete = vi.fn();
		const newComplete = vi.fn();
		Effect.runSync(
			scene.presentation.disappearFx({
				actor,
				onCompleteFn: oldComplete,
			}),
		);
		scene.tweens[0]?.updateFn(0.5);
		Effect.runSync(
			scene.presentation.appearFx({
				actor,
				initial: false,
				onCompleteFn: newComplete,
			}),
		);
		scene.tweens[0]?.completeFn();
		scene.tweens[1]?.completeFn();
		expect(oldComplete).not.toHaveBeenCalled();
		scene.tweens[2]?.completeFn();
		scene.tweens[3]?.completeFn();
		expect(newComplete).toHaveBeenCalledOnce();
	});

	it("starts Board entry above the previous Board and ignores the stale exit", () => {
		const scene = harness();
		const exitComplete = vi.fn();
		const enterComplete = vi.fn();
		Effect.runSync(scene.presentation.exitBoardFx(exitComplete));
		scene.tweens[0]?.updateFn(0.5);
		Effect.runSync(scene.presentation.enterBoardFx(enterComplete));
		scene.tweens[1]?.updateFn(0);
		expect(scene.boardPresentationLayer.alpha).toBe(0);
		expect(scene.boardPresentationLayer.y).toBe(-40);
		scene.tweens[0]?.completeFn();
		expect(exitComplete).not.toHaveBeenCalled();
		scene.tweens[1]?.updateFn(1);
		scene.tweens[1]?.completeFn();
		expect(scene.boardPresentationLayer.alpha).toBe(1);
		expect(scene.boardPresentationLayer.y).toBe(0);
		expect(enterComplete).toHaveBeenCalledOnce();
	});

	it("follows a target that moves during travel without a position jump", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:traveler");
		let target = {
			x: 100,
			y: 0,
			size: 100,
		};
		Effect.runSync(
			scene.presentation.travelFx({
				actor,
				readTargetFn: () => target,
				target,
			}),
		);
		scene.tweens[0]?.updateFn(0.5);
		const before = actor.container.x;
		target = {
			x: 200,
			y: 0,
			size: 100,
		};
		scene.tweens[0]?.updateFn(0.5);
		expect(actor.container.x).toBe(before);
		scene.tweens[0]?.updateFn(1);
		expect(actor.container.x).toBe(200);
	});

	it("starts an output flight only when its artwork is ready", () => {
		const scene = harness();
		const actor = scene.createActor("runtime:output", false);
		actor.container.position.set(25, 30);
		Effect.runSync(
			scene.presentation.travelFx({
				actor,
				readTargetFn: () => ({
					x: 125,
					y: 30,
					size: 100,
				}),
				target: {
					x: 125,
					y: 30,
					size: 100,
				},
			}),
		);
		expect(scene.tweens).toHaveLength(0);
		expect(actor.container.x).toBe(25);
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				generation: 0,
				visual: actor.currentVisual,
			}),
		);
		expect(scene.tweens).toHaveLength(1);
		scene.tweens[0]?.updateFn(1);
		expect(actor.container.x).toBe(125);
	});
});
