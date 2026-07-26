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
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import { readPixiTileMagneticDisplacementFx } from "~/ui/pixi/magnet/readPixiTileMagneticDisplacementFx";
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
				},
				crowdLayer: {
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
				surface: {
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed({
							layer: {} as never,
							size: 80,
							x: item.location.position.x * 80,
							y: 0,
						}),
				} as unknown as PixiMainSceneSurface,
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
		Effect.runSync(field.resetFx);
		expect(springs[0]?.setTarget).toHaveBeenLastCalledWith(0);
		expect(springs[1]?.setTarget).toHaveBeenLastCalledWith(0);

		const replacement = createActor(target.item.id, 1);
		actors.set(target.item.id, replacement);
		Effect.runSync(field.pruneFx);
		expect(springs[0]?.close).toHaveBeenCalledOnce();
		expect(springs[1]?.close).toHaveBeenCalledOnce();
		expect(target.crowdLayer.position.set).toHaveBeenCalledWith(0);

		Effect.runSync(field.updateFx(sample));
		expect(springs).toHaveLength(4);
		Effect.runSync(field.closeFx);
		expect(springs[2]?.close).toHaveBeenCalledOnce();
		expect(springs[3]?.close).toHaveBeenCalledOnce();
		expect(replacement.crowdLayer.position.set).toHaveBeenCalledWith(0);
	});
});
