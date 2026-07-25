import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
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
		});

		expect(displacement.x).toBeLessThan(0);
		expect(displacement.y).toBe(-0);
		expect(Math.hypot(displacement.x, displacement.y)).toBeLessThanOrEqual(4.5);
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
});
