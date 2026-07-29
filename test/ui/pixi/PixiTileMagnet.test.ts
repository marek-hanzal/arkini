import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorRect } from "~/ui/pixi/magnet/readPixiTileActorRect";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiTileMagneticFieldFx } from "~/ui/pixi/magnet/createPixiTileMagneticFieldFx";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";

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
	it("reads independent scale and pivot geometry on both axes", () => {
		expect(
			readPixiTileActorRect({
				container: {
					pivot: {
						x: 10,
						y: 20,
					},
					scale: {
						x: 1.5,
						y: 0.5,
					},
					x: 100,
					y: 80,
				},
				height: 160,
				width: 240,
			} as PixiTileActor),
		).toEqual({
			height: 80,
			width: 360,
			x: 85,
			y: 70,
		});
	});

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
				scheduleApply: (apply) => scheduled.push(apply),
			}),
		);
		const sample = {
			attractedActorId: null,
			eligibleAttractionActorIds: new Set<string>(),
			sourceActorId: "runtime:source",
			sourceDirection: null,
			sourceItem: targetItem,
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
		scheduled[0]?.();
		expect(scheduled).toHaveLength(1);

		Effect.runSync(
			field.releaseFx({
				sourceActorId: "runtime:missing",
				sourceKind: "motion",
			}),
		);
		Effect.runSync(field.releaseSourcesFx("motion"));
		expect(scheduled).toHaveLength(1);

		Effect.runSync(
			field.releaseFx({
				sourceActorId: sample.sourceActorId,
				sourceKind: "drag",
			}),
		);
		expect(scheduled).toHaveLength(2);
		Effect.runSync(field.closeFx);
		expect(() => scheduled[1]?.()).not.toThrow();
	});

	it("samples only unique actors returned by the local padded-cell broad phase", () => {
		let distantPoseReads = 0;
		let nearPoseReads = 0;
		const createActor = (id: string, x: number, countReads = false) =>
			({
				container: {
					destroyed: false,
					pivot: {
						x: 0,
						y: 0,
					},
					scale: {
						x: 1,
						y: 1,
					},
					get x() {
						if (countReads) distantPoseReads += 1;
						if (id === "runtime:near") nearPoseReads += 1;
						return x;
					},
					y: 0,
				},
				height: 80,
				item: {
					footprint: {
						height: 1,
						width: 1,
					},
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
				offsetLayer: {
					position: {
						set: vi.fn(),
					},
					x: 0,
					y: 0,
				},
				size: 80,
				width: 80,
			}) as unknown as PixiTileActor;
		const source = createActor("runtime:source", 0);
		const near = createActor("runtime:near", 80);
		const distant = Array.from(
			{
				length: 200,
			},
			(_, index) => createActor(`runtime:distant:${index}`, 2_000 + index * 80, true),
		);
		const actors = new Map(
			[
				source,
				near,
				...distant,
			].map((actor) => [
				actor.item.id,
				actor,
			]),
		);
		const field = Effect.runSync(
			createPixiTileMagneticFieldFx({
				actorStore: {
					actors,
				} as unknown as PixiMainSceneActorStore,
				animationDriver: {
					closeFx: Effect.void,
					createSpringFx: () =>
						Effect.succeed({
							closeFx: Effect.void,
							setTargetFx: () => Effect.void,
						}),
					startTweenFx: () =>
						Effect.succeed({
							stopFx: Effect.void,
						}),
				},
				readLocalActorIds: () =>
					new Set([
						near.item.id,
					]),
				scheduleApply: (apply) => apply(),
			}),
		);

		Effect.runSync(
			field.updateFx({
				attractedActorId: null,
				eligibleAttractionActorIds: new Set(),
				sourceActorId: source.item.id,
				sourceDirection: {
					x: 1,
					y: 0,
				},
				sourceItem: source.item,
				sourceX: 0,
				sourceY: 0,
			}),
		);

		expect(nearPoseReads).toBeGreaterThan(0);
		expect(distantPoseReads).toBe(0);
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
						y: 1,
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
				height: 80,
				width: 80,
			}) as unknown as PixiTileActor;
		const source = createActor("runtime:source", 0);
		const target = createActor("runtime:target", 1);
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
			createPixiTileMagneticFieldFx({
				actorStore: {
					actors,
				} as unknown as PixiMainSceneActorStore,
				animationDriver,
				scheduleApply: (apply) => apply(),
			}),
		);
		const sample = {
			attractedActorId: null,
			eligibleAttractionActorIds: new Set<string>(),
			sourceActorId: source.item.id,
			sourceDirection: {
				x: 1,
				y: 0,
			},
			sourceItem: source.item,
			sourceX: 0,
			sourceY: 0,
		};

		Effect.runSync(field.updateFx(sample));
		Effect.runSync(field.updateFx(sample));
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
						y: 1,
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
				height: 80,
				width: 80,
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
				scheduleApply: (apply) => apply(),
			}),
		);

		Effect.runSync(
			field.updateFx({
				attractedActorId: null,
				eligibleAttractionActorIds: new Set(),
				sourceActorId: receiver.item.id,
				sourceDirection: {
					x: 1,
					y: 0,
				},
				sourceItem: receiver.item,
				sourceX: 80,
				sourceY: 0,
			}),
		);
		Effect.runSync(
			field.updateFx({
				attractedActorId: receiver.item.id,
				eligibleAttractionActorIds: new Set([
					receiver.item.id,
				]),
				sourceActorId: "motion:incoming",
				sourceDirection: {
					x: 1,
					y: 0,
				},
				sourceItem: receiver.item,
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
				sourceKind: "motion",
			}),
		);
		expect(targets[2]).toHaveBeenCalledTimes(receiverTargetCount ?? 0);
		Effect.runSync(field.releaseSourcesFx("motion"));
		expect(targets[2]).toHaveBeenLastCalledWith(0);
		expect(targets[0]?.mock.lastCall?.[0]).toBeGreaterThan(0);
	});
});
