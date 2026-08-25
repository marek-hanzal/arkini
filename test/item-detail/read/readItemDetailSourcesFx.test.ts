import { describe, expect, it } from "vitest";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import {
	config,
	readSources,
	runtime,
	runtimeItem,
} from "./readItemDetailSourcesFx.test/fixture";

const available = (result: ReturnType<typeof readSources>) => {
	if (result.kind !== "available") throw new Error("Expected available Sources.");
	return result;
};

const target = { kind: "runtime", itemId: "runtime:target" } as const;

describe("readItemDetailSourcesFx", () => {
	it("returns exact owned Sources in deterministic Board order with output facts", () => {
		const result = available(readSources(target));

		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:beta:current",
			"runtime:alpha:space-0",
			"runtime:alpha:space-3",
			"runtime:alpha:stored",
		]);
		expect(result.source[1]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:alpha:first",
			"line:alpha:second",
		]);
		expect(result.source[1]?.line[0]?.output).toEqual([
			{
				kind: "guaranteed",
				quantity: { min: 2, max: 2 },
				setWeight: 3,
				totalSetWeight: 4,
			},
			{
				kind: "chance",
				chance: 0.65,
				quantity: { min: 1, max: 4 },
				setWeight: 3,
				totalSetWeight: 4,
			},
		]);
		expect(result.source[3]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:hidden",
			"line:alpha:first",
			"line:alpha:second",
		]);
	});

	it("resolves configured definition Sources without an equal runtime target", () => {
		const result = available(
			readSources(
				{ kind: "definition", itemId: "target" },
				{
					...runtime,
					items: runtime.items.filter(({ item }) => item.id !== "target"),
				},
			),
		);

		expect(result).toMatchObject({
			itemId: "target",
			targetDefinitionItemId: "target",
		});
		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:beta:current",
			"runtime:alpha:space-0",
			"runtime:alpha:space-3",
			"runtime:alpha:stored",
		]);
	});

	it("keeps off-Board owners exact and deterministically ordered", () => {
		const stored = runtime.items.find(({ id }) => id === "runtime:alpha:stored");
		const runtimeTarget = runtime.items.find(({ id }) => id === "runtime:target");
		if (stored === undefined || runtimeTarget === undefined) throw new Error("Missing fixtures.");
		const inventory = runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:inventory",
			location: { scope: "inventory", position: { x: 1, y: 0 } },
		});

		const result = available(
			readSources(target, { ...runtime, items: [runtimeTarget, inventory, stored] }),
		);

		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:alpha:inventory",
			"runtime:alpha:stored",
		]);
		expect(result.source.map(({ line }) => line.map(({ lineId }) => lineId))).toEqual([
			["line:hidden", "line:alpha:first", "line:alpha:second"],
			["line:hidden", "line:alpha:first", "line:alpha:second"],
		]);
	});

	it("applies show rules to hidden Board lines", () => {
		const alpha = config.items.alpha;
		const runtimeTarget = runtime.items.find(({ id }) => id === "runtime:target");
		if (alpha.type !== "producer" || runtimeTarget === undefined) throw new Error("Missing fixtures.");
		const hiddenOwner = {
			...runtimeItem({
				definition: "alpha",
				id: "runtime:alpha:hidden-only",
				location: { scope: "board", space: 0, position: { x: 0, y: 0 } },
			}),
			item: { ...alpha, lines: [alpha.lines[0]] },
		} satisfies RuntimeItemSchema.Type;
		const withoutPermit = { ...runtime, items: [runtimeTarget, hiddenOwner] };
		const permit = runtimeItem({
			definition: "permit",
			id: "runtime:permit",
			location: { scope: "inventory", position: { x: 1, y: 0 } },
		});

		expect(available(readSources(target, withoutPermit)).source).toEqual([]);
		expect(
			available(readSources(target, { ...withoutPermit, items: [...withoutPermit.items, permit] }))
				.source[0]?.line.map(({ lineId }) => lineId),
		).toEqual(["line:hidden"]);
	});

	it("keeps an active hidden Board line visible", () => {
		const result = available(
			readSources(target, {
				...runtime,
				jobs: [
					{
						id: "job:hidden",
						ownerItemId: "runtime:alpha:space-0",
						lineId: "line:hidden",
						durationMs: 1_000,
						remainingMs: 400,
					},
				] satisfies RuntimeSchema.Type["jobs"],
			}),
		);

		expect(result.source[1]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:hidden",
			"line:alpha:first",
			"line:alpha:second",
		]);
	});

	it("omits configured Sources the player does not own", () => {
		const result = available(
			readSources(
				{ kind: "definition", itemId: "target" },
				{
					...runtime,
					items: runtime.items.filter(({ item }) => item.id === "target"),
				},
			),
		);

		expect(result.source).toEqual([]);
	});

	it("uses an owned off-Board blueprint as the direct Source of its product", () => {
		const blueprint = runtimeItem({
			definition: "blueprint",
			id: "runtime:blueprint",
			location: { scope: "inventory", position: { x: 0, y: 0 } },
		});
		const result = available(
			readSources(
				{ kind: "definition", itemId: "product" },
				{ ...runtime, items: [blueprint] },
			),
		);

		expect(result.source).toMatchObject([
			{
				ownerItemId: blueprint.id,
				ownerDefinitionItemId: "blueprint",
				line: [{ lineId: "line:blueprint" }],
			},
		]);
	});

	it("resolves one configured blueprint hop to an owned producer", () => {
		const townHall = runtimeItem({
			definition: "town-hall",
			id: "runtime:town-hall",
			location: { scope: "board", space: 0, position: { x: 0, y: 0 } },
		});
		const result = available(
			readSources(
				{ kind: "definition", itemId: "product" },
				{ ...runtime, currentSpace: 0, items: [townHall] },
			),
		);

		expect(result).toMatchObject({
			itemId: "product",
			targetDefinitionItemId: "blueprint",
			source: [
				{
					ownerItemId: "runtime:town-hall",
					ownerDefinitionItemId: "town-hall",
					line: [{ lineId: "line:town-hall:blueprint" }],
				},
			],
		});
	});

	it("rejects missing definition and stale runtime targets", () => {
		expect(readSources({ kind: "definition", itemId: "definition:missing" })).toEqual({
			kind: "unavailable",
		});
		expect(readSources({ kind: "runtime", itemId: "runtime:missing" })).toEqual({
			kind: "unavailable",
		});
	});
});
