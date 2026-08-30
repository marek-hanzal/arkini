import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import { createMagneticFieldFx } from "~/tile-motion/fx/createMagneticFieldFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";

import { createMagneticActor, createSpringDriverProbe } from "./createMagneticFieldFx.test/fixture";

describe("magnetic field", () => {
	it("coalesces pending projection and cancels it on close", () => {
		const scheduled: Array<() => void> = [];
		const field = Effect.runSync(
			createMagneticFieldFx({
				actorStore: {
					actors: new Map(),
				} as unknown as MainActorStore,
				animationDriver: {
					closeFx: Effect.void,
					createSpringFx: () =>
						Effect.die("An empty actor store must not acquire springs."),
					startTweenFx: () => Effect.die("Magnet does not own tweens."),
				},
				scheduleApply: (apply) => {
					scheduled.push(apply);
					return () => {
						const index = scheduled.indexOf(apply);
						if (index >= 0) scheduled.splice(index, 1);
					};
				},
			}),
		);
		const sample = {
			attractedActorId: null,
			candidateActorIds: [],
			eligibleAttractionActorIds: new Set<string>(),
			sourceActorId: "runtime:source",
			sourceInstanceId: "pixi:source",
			sourceDirection: null,
			sourceX: 0,
			sourceY: 0,
		};

		Effect.runSync(field.updateFx(sample));
		Effect.runSync(
			field.updateFx({
				...sample,
				sourceX: 40,
			}),
		);
		expect(scheduled).toHaveLength(1);
		scheduled.shift()?.();
		expect(scheduled).toHaveLength(0);

		Effect.runSync(
			field.releaseFx({
				sourceActorId: sample.sourceActorId,
				sourceInstanceId: sample.sourceInstanceId,
				sourceKind: "drag",
			}),
		);
		expect(scheduled).toHaveLength(1);
		Effect.runSync(field.closeFx);
		expect(scheduled).toHaveLength(0);
	});

	it("keeps projector release terminal against late pose callbacks", () => {
		const update = vi.fn();
		const release = vi.fn();
		const actor = createMagneticActor("runtime:source", 0);
		const projector = Effect.runSync(
			createMagneticProjectorFx({
				actor,
				attractedActorId: null,
				eligibleAttractionActorIds: new Set(),
				magneticField: {
					releaseFx: (source: Parameters<MagneticField["releaseFx"]>[0]) =>
						Effect.sync(() => release(source)),
					updateFx: (sample: Parameters<MagneticField["updateFx"]>[0]) =>
						Effect.sync(() => update(sample)),
				} as unknown as MagneticField,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
				} as unknown as MainSurface,
			}),
		);

		projector.projectPose({
			scale: 1,
			x: 20,
			y: 0,
		});
		projector.release();
		projector.projectPose({
			scale: 1,
			x: 40,
			y: 0,
		});

		expect(update).toHaveBeenCalledOnce();
		expect(release).toHaveBeenCalledOnce();
		expect(release).toHaveBeenCalledWith({
			sourceActorId: actor.item.id,
			sourceInstanceId: actor.instanceId,
			sourceKind: "motion",
		});
	});

	it("reuses springs and releases exact actor generations on prune and close", () => {
		const { animationDriver, springs } = createSpringDriverProbe();
		const source = createMagneticActor("runtime:source", 0);
		const target = createMagneticActor("runtime:target", 1);
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				target.item.id,
				target,
			],
		]);
		const field = Effect.runSync(
			createMagneticFieldFx({
				actorStore: {
					actors,
				} as unknown as MainActorStore,
				animationDriver,
				scheduleApply: (apply) => {
					apply();
					return () => {};
				},
			}),
		);
		const sample = {
			attractedActorId: null,
			candidateActorIds: [
				target.item.id,
			],
			eligibleAttractionActorIds: new Set<string>(),
			sourceActorId: source.item.id,
			sourceInstanceId: source.instanceId,
			sourceDirection: {
				x: 1,
				y: 0,
			},
			sourceX: 0,
			sourceY: 0,
		};

		Effect.runSync(field.updateFx(sample));
		Effect.runSync(field.updateFx(sample));
		expect(springs).toHaveLength(2);

		const replacement = createMagneticActor(target.item.id, 1);
		actors.set(target.item.id, replacement);
		Effect.runSync(field.pruneFx);
		expect(springs[0]?.close).toHaveBeenCalledOnce();
		expect(springs[1]?.close).toHaveBeenCalledOnce();
		expect(target.offsetLayer.position.set).toHaveBeenCalledWith(0);

		Effect.runSync(field.updateFx(sample));
		expect(springs).toHaveLength(4);
		Effect.runSync(field.closeFx);
		expect(springs[2]?.close).toHaveBeenCalledOnce();
		expect(springs[3]?.close).toHaveBeenCalledOnce();
		expect(replacement.offsetLayer.position.set).toHaveBeenCalledWith(0);
	});

	it("keeps drag and motion owners isolated until their exact release", () => {
		const { animationDriver, springs } = createSpringDriverProbe();
		const receiver = createMagneticActor("runtime:receiver", 1);
		const neighbour = createMagneticActor("runtime:neighbour", 2);
		const field = Effect.runSync(
			createMagneticFieldFx({
				actorStore: {
					actors: new Map([
						[
							receiver.item.id,
							receiver,
						],
						[
							neighbour.item.id,
							neighbour,
						],
					]),
				} as unknown as MainActorStore,
				animationDriver,
				scheduleApply: (apply) => {
					apply();
					return () => {};
				},
			}),
		);

		Effect.runSync(
			field.updateFx({
				attractedActorId: null,
				candidateActorIds: [
					neighbour.item.id,
				],
				eligibleAttractionActorIds: new Set(),
				sourceActorId: receiver.item.id,
				sourceInstanceId: receiver.instanceId,
				sourceDirection: {
					x: 1,
					y: 0,
				},
				sourceX: 80,
				sourceY: 0,
			}),
		);
		Effect.runSync(
			field.updateFx({
				attractedActorId: receiver.item.id,
				candidateActorIds: [
					receiver.item.id,
					neighbour.item.id,
				],
				eligibleAttractionActorIds: new Set([
					receiver.item.id,
				]),
				sourceActorId: "motion:incoming",
				sourceInstanceId: "pixi:incoming",
				sourceDirection: {
					x: 1,
					y: 0,
				},
				sourceKind: "motion",
				sourceSize: 80,
				sourceX: 0,
				sourceY: 0,
			}),
		);

		const dragTarget = springs[0]?.setTarget;
		const motionTarget = springs[2]?.setTarget;
		expect(dragTarget?.mock.lastCall?.[0]).toBeGreaterThan(0);
		expect(motionTarget?.mock.lastCall?.[0]).toBeLessThan(0);
		const motionTargetCalls = motionTarget?.mock.calls.length;
		Effect.runSync(
			field.releaseFx({
				sourceActorId: receiver.item.id,
				sourceInstanceId: receiver.instanceId,
				sourceKind: "motion",
			}),
		);
		expect(motionTarget).toHaveBeenCalledTimes(motionTargetCalls ?? 0);

		Effect.runSync(field.releaseSourcesFx("motion"));
		expect(motionTarget).toHaveBeenLastCalledWith(0);
		expect(dragTarget?.mock.lastCall?.[0]).toBeGreaterThan(0);
		Effect.runSync(field.closeFx);
	});
});
