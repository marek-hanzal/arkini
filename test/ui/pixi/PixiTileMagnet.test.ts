import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiTileMagneticFieldFx } from "~/ui/pixi/magnet/createPixiTileMagneticFieldFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

const targetItem = {
	id: "runtime:target",
} as TileActorItem;

const readDisplacement = (overrides: Partial<readPixiTileMagneticDisplacementFx.Props> = {}) =>
	Effect.runSync(
		readPixiTileMagneticDisplacementFx({
			actorId: "runtime:target",
			actorRect: {
				height: 100,
				width: 100,
				x: 100,
				y: 0,
			},
			attractedActorId: null,
			eligibleAttractionActorIds: new Set(),
			sourceActorId: "runtime:source",
			sourceDirection: {
				x: 1,
				y: 0,
			},
			sourceRect: {
				height: 100,
				width: 100,
				x: 0,
				y: 0,
			},
			...overrides,
		}),
	);

describe("Pixi tile magnet", () => {
	it("does not move actors outside the magnetic radius", () => {
		expect(
			readDisplacement({
				actorRect: {
					height: 100,
					width: 100,
					x: 151,
					y: 0,
				},
			}),
		).toEqual({
			x: 0,
			y: 0,
		});
	});

	it("repels ordinary neighbours and caps displacement below fourteen percent", () => {
		const displacement = readDisplacement();

		expect(displacement.x).toBeGreaterThan(0);
		expect(displacement.y).toBe(0);
		expect(Math.hypot(displacement.x, displacement.y)).toBeLessThanOrEqual(14);
	});

	it("attracts only the engine-confirmed combine actor", () => {
		const displacement = readDisplacement({
			attractedActorId: "runtime:target",
			eligibleAttractionActorIds: new Set([
				"runtime:target",
			]),
		});

		expect(displacement.x).toBeLessThan(0);
		expect(displacement.y).toBe(-0);
		expect(Math.hypot(displacement.x, displacement.y)).toBeLessThanOrEqual(4.5);
	});

	it("keeps eligible responders neutral before hover while invalid neighbours repel", () => {
		expect(
			readDisplacement({
				eligibleAttractionActorIds: new Set([
					"runtime:target",
				]),
			}),
		).toEqual({
			x: 0,
			y: 0,
		});
		expect(
			readDisplacement({
				eligibleAttractionActorIds: new Set([
					"runtime:other",
				]),
			}).x,
		).toBeGreaterThan(0);
	});

	it("excludes the dragged source and resolves exact overlap deterministically", () => {
		expect(
			readDisplacement({
				actorId: "runtime:source",
			}),
		).toEqual({
			x: 0,
			y: 0,
		});
		const first = readDisplacement({
			actorRect: {
				height: 100,
				width: 100,
				x: 0,
				y: 0,
			},
			sourceDirection: null,
		});
		const second = readDisplacement({
			actorRect: {
				height: 100,
				width: 100,
				x: 0,
				y: 0,
			},
			sourceDirection: null,
		});

		expect(first).toEqual(second);
		expect(Math.hypot(first.x, first.y)).toBeCloseTo(14);
	});

	it.each([
		"merge",
		"stack",
		"store-input",
	] as const)("attracts the occupied target for %s", (previewKind) => {
		expect(
			Effect.runSync(
				readPixiTileAttractionActorIdFx({
					previewKind,
					targetItem,
				}),
			),
		).toBe(targetItem.id);
	});

	it.each([
		"move",
		"swap",
		"store-inventory",
		"ignored",
		"reject",
	] as const)("does not attract the occupied target for %s", (previewKind) => {
		expect(
			Effect.runSync(
				readPixiTileAttractionActorIdFx({
					previewKind,
					targetItem,
				}),
			),
		).toBeNull();
	});

	it("coalesces multiple source updates into one magnetic projection pass", () => {
		const scheduled: Array<() => void> = [];
		const field = Effect.runSync(
			createPixiTileMagneticFieldFx({
				actorStore: {
					actors: new Map(),
				} as unknown as PixiMainSceneActorStore,
				animationDriver: {
					closeFx: Effect.void,
					createSpringFx: () =>
						Effect.die("An empty actor store must not acquire springs."),
					startTweenFx: () =>
						Effect.succeed({
							stopFx: Effect.void,
						}),
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
				sourceActorId: "runtime:missing",
				sourceInstanceId: "pixi:missing",
				sourceKind: "motion",
			}),
		);
		Effect.runSync(field.releaseSourcesFx("motion"));
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
		const actor = {
			container: {
				pivot: {
					x: 0,
					y: 0,
				},
				scale: {
					x: 1,
					y: 1,
				},
				x: 0,
				y: 0,
			},
			instanceId: "pixi:source",
			item: {
				...targetItem,
				location: {
					position: {
						x: 0,
						y: 0,
					},
					scope: "board",
					space: 0,
				},
			},
			size: 80,
		} as unknown as PixiTileActor;
		const projector = Effect.runSync(
			createPixiTileMotionMagneticProjectorFx({
				actor,
				attractedActorId: null,
				eligibleAttractionActorIds: new Set(),
				magneticField: {
					releaseFx: (source: Parameters<PixiTileMagneticField["releaseFx"]>[0]) =>
						Effect.sync(() => release(source)),
					updateFx: (sample: Parameters<PixiTileMagneticField["updateFx"]>[0]) =>
						Effect.sync(() => update(sample)),
				} as unknown as PixiTileMagneticField,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
				} as unknown as PixiMainSceneSurface,
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
			sourceActorId: targetItem.id,
			sourceInstanceId: actor.instanceId,
			sourceKind: "motion",
		});
	});

	it("reuses, prunes and closes persistent actor spring pairs", () => {
		const springs: Array<{
			readonly close: ReturnType<typeof vi.fn>;
			readonly setTarget: ReturnType<typeof vi.fn>;
		}> = [];
		const animationDriver = {
			closeFx: Effect.void,
			createSpringFx: () =>
				Effect.sync(() => {
					const close = vi.fn();
					const setTarget = vi.fn();
					springs.push({
						close,
						setTarget,
					});
					return {
						closeFx: Effect.sync(close),
						setTargetFx: (value) => Effect.sync(() => setTarget(value)),
					} satisfies PixiAnimationSpring;
				}),
			startTweenFx: () =>
				Effect.succeed({
					stopFx: Effect.void,
				}),
		} satisfies PixiAnimationDriver;
		const createActor = (id: string, x: number) =>
			({
				container: {
					destroyed: false,
					pivot: {
						x: 0,
						y: 0,
					},
					scale: {
						x: 1,
					},
					x: x * 80,
					y: 0,
				},
				offsetLayer: {
					position: {
						set: vi.fn(),
					},
					x: 0,
					y: 0,
				},
				item: {
					id,
					location: {
						position: {
							x,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
				},
				size: 80,
			}) as unknown as PixiTileActor;
		const source = createActor("runtime:source", 0);
		const target = createActor("runtime:target", 1);
		const distant = createActor("runtime:distant", 40);
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				target.item.id,
				target,
			],
			[
				distant.item.id,
				distant,
			],
		]);
		const displacementEvaluations: Array<
			[
				string,
				string,
			]
		> = [];
		const field = Effect.runSync(
			createPixiTileMagneticFieldFx({
				actorStore: {
					actors,
				} as unknown as PixiMainSceneActorStore,
				animationDriver,
				onDisplacementEvaluation: (actorId, sourceActorId) =>
					displacementEvaluations.push([
						actorId,
						sourceActorId,
					]),
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
			sourceInstanceId: "pixi:source",
			sourceDirection: {
				x: 1,
				y: 0,
			},
			sourceX: 0,
			sourceY: 0,
		};

		Effect.runSync(field.updateFx(sample));
		expect(displacementEvaluations).toEqual([
			[
				target.item.id,
				source.item.id,
			],
		]);
		Effect.runSync(field.updateFx(sample));
		expect(displacementEvaluations).toHaveLength(2);
		expect(springs).toHaveLength(2);
		expect(springs[0]?.setTarget).toHaveBeenCalledOnce();
		expect(springs[1]?.setTarget).not.toHaveBeenCalled();
		Effect.runSync(field.resetFx);
		expect(springs[0]?.setTarget).toHaveBeenLastCalledWith(0);
		expect(springs[1]?.setTarget).not.toHaveBeenCalled();

		const replacement = createActor(target.item.id, 1);
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

	it("composes an incoming payload with a receiver drag without flipping polarity", () => {
		const targets: Array<ReturnType<typeof vi.fn>> = [];
		const animationDriver = {
			closeFx: Effect.void,
			createSpringFx: () =>
				Effect.sync(() => {
					const setTarget = vi.fn();
					targets.push(setTarget);
					return {
						closeFx: Effect.void,
						setTargetFx: (value) => Effect.sync(() => setTarget(value)),
					} satisfies PixiAnimationSpring;
				}),
			startTweenFx: () =>
				Effect.succeed({
					stopFx: Effect.void,
				}),
		} satisfies PixiAnimationDriver;
		const createActor = (id: string, x: number) =>
			({
				container: {
					destroyed: false,
					pivot: {
						x: 0,
						y: 0,
					},
					scale: {
						x: 1,
					},
					x,
					y: 0,
				},
				offsetLayer: {
					position: {
						set: vi.fn(),
					},
					x: 0,
					y: 0,
				},
				item: {
					id,
					location: {
						position: {
							x: x / 80,
							y: 0,
						},
						scope: "board",
						space: 0,
					},
				},
				size: 80,
			}) as unknown as PixiTileActor;
		const receiver = createActor("runtime:receiver", 80);
		const neighbour = createActor("runtime:neighbour", 160);
		const field = Effect.runSync(
			createPixiTileMagneticFieldFx({
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
				} as unknown as PixiMainSceneActorStore,
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
				sourceInstanceId: "pixi:receiver",
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

		expect(targets[2]?.mock.lastCall?.[0]).toBeLessThan(0);
		const receiverTargetCount = targets[2]?.mock.calls.length;
		Effect.runSync(
			field.releaseFx({
				sourceActorId: receiver.item.id,
				sourceInstanceId: "pixi:receiver",
				sourceKind: "motion",
			}),
		);
		expect(targets[2]).toHaveBeenCalledTimes(receiverTargetCount ?? 0);
		Effect.runSync(field.releaseSourcesFx("motion"));
		expect(targets[2]).toHaveBeenLastCalledWith(0);
		expect(targets[0]?.mock.lastCall?.[0]).toBeGreaterThan(0);
	});
});
