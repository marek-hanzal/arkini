import { describe, expect, it } from "vitest";

import { readNeighborhoodArtworkFn } from "~/tile-presentation/fn/readNeighborhoodArtworkFn";
import { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";
import { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { createSimpleItem } from "~test/game-config-validation/support/gameValidationTestSource";

const ignore = {
	type: "ignore",
} as const;
const rule = (
	sourceId: string,
	neighbors: Partial<NeighborhoodArtworkRuleSchema.Type["neighbors"]> = {},
): NeighborhoodArtworkRuleSchema.Type => ({
	sourceId,
	neighbors: {
		nw: ignore,
		n: ignore,
		ne: ignore,
		w: ignore,
		e: ignore,
		sw: ignore,
		s: ignore,
		se: ignore,
		...neighbors,
	},
});
const placed = (
	id: string,
	x: number,
	y: number,
	rules?: NeighborhoodArtworkRuleSchema.Type[],
	layer = "ground",
	space = 0,
) =>
	RuntimeItemSchema.parse({
		id,
		revision: `revision:${id}`,
		quantity: 1,
		item: {
			...createSimpleItem("road"),
			layer,
			asset: {
				scale: 1,
				default: [
					"road-single",
				],
				neighbors: rules,
			},
		},
		location: {
			scope: "board",
			space,
			position: {
				x,
				y,
			},
		},
	});

describe("readNeighborhoodArtworkFn", () => {
	it("joins diagonals by definition identity, keeps author order, and recomputes both ends after a move", () => {
		const road = {
			type: "item",
			itemId: "road",
		} as const;
		const center = placed("center", 1, 1, [
			rule("diagonal", {
				sw: road,
				ne: road,
			}),
			rule("end", {
				sw: road,
			}),
			rule("fallback"),
		]);
		const southwest = placed("southwest", 0, 2, [
			rule("joined-end", {
				ne: road,
			}),
		]);
		const northeast = placed("northeast", 2, 0);
		const before = [
			center,
			southwest,
			northeast,
		];
		const snapshot = structuredClone(before);
		expect([
			...readNeighborhoodArtworkFn(before),
		]).toEqual([
			[
				"center",
				"diagonal",
			],
			[
				"southwest",
				"joined-end",
			],
		]);
		expect(
			readNeighborhoodArtworkFn([
				center,
				southwest,
			]).get("center"),
		).toBe("end");
		const moved = {
			...center,
			location: {
				...center.location,
				position: {
					x: 3,
					y: 3,
				},
			},
		};
		expect([
			...readNeighborhoodArtworkFn([
				moved,
				southwest,
				northeast,
			]),
		]).toEqual([
			[
				"center",
				"fallback",
			],
		]);
		expect(before).toEqual(snapshot);
	});

	it("checks real occupants in the same layer and space, independent of artwork and item quantity", () => {
		const center = placed("center", 1, 1, [
			rule("filled", {
				e: {
					type: "filled",
				},
				w: {
					type: "empty",
				},
			}),
		]);
		const covered = placed("covered", 2, 1, undefined, "content");
		const elsewhere = placed("elsewhere", 2, 1, undefined, "ground", 1);
		expect(
			readNeighborhoodArtworkFn([
				center,
				covered,
				elsewhere,
			]).size,
		).toBe(0);
		const neighbor = placed("neighbor", 2, 1, [
			rule("unrelated-picture"),
		]);
		neighbor.item = {
			...neighbor.item,
			id: "sand",
		};
		neighbor.quantity = 5;
		expect(
			readNeighborhoodArtworkFn([
				center,
				covered,
				elsewhere,
				neighbor,
			]).get("center"),
		).toBe("filled");
		const occupiedWest = placed("west", 0, 1);
		expect(
			readNeighborhoodArtworkFn([
				center,
				neighbor,
				occupiedWest,
			]).has("center"),
		).toBe(false);
		const origin = {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const inTransit = RuntimeItemSchema.parse({
			...neighbor,
			location: {
				scope: "delivery",
				phase: "returning",
				generation: 0,
				origin,
				returnFrom: origin,
				remainingDurationMs: 10,
			},
		});
		expect(
			readNeighborhoodArtworkFn([
				center,
				inTransit,
			]).has("center"),
		).toBe(false);
	});

	it("treats outside neighbors as empty and never applies rules to inventory or toolbar", () => {
		const edge = placed("edge", 0, 0, [
			rule("edge", {
				nw: {
					type: "empty",
				},
				n: {
					type: "empty",
				},
				w: {
					type: "empty",
				},
			}),
		]);
		expect(
			readNeighborhoodArtworkFn([
				edge,
			]).get("edge"),
		).toBe("edge");
		for (const scope of [
			"inventory",
			"toolbar",
		] as const) {
			const stored = {
				...edge,
				location: {
					scope,
					position: {
						x: 0,
						y: 0,
					},
				},
			};
			expect(
				readNeighborhoodArtworkFn([
					stored,
				]).size,
			).toBe(0);
		}
	});
});
