import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};

const swapCandidate = {
	source: {
		id: "runtime:source",
		location: sourceLocation,
		revision: "revision:source",
	},
	target: {
		id: "runtime:target",
		location: targetLocation,
		revision: "revision:target",
	},
} as const;

const moveResult = {
	itemId: swapCandidate.source.id,
	kind: "move",
	location: targetLocation,
	previousLocation: sourceLocation,
	revision: "revision:moved",
} satisfies DropItemResult;

const swapResult = {
	kind: "swap",
	source: {
		itemId: swapCandidate.source.id,
		location: targetLocation,
		previousLocation: sourceLocation,
		revision: "revision:source-swapped",
	},
	target: {
		itemId: swapCandidate.target.id,
		location: sourceLocation,
		previousLocation: targetLocation,
		revision: "revision:target-swapped",
	},
} satisfies DropItemResult;

describe("drop presentation", () => {
	it("settles one drop without clearing another pending generation", () => {
		const presentation = Effect.runSync(createDropPresentationFx());
		const first = Effect.runSync(
			presentation.beginFx({
				sourceActorId: "runtime:first",
				swapCandidate: null,
			}),
		);
		const second = Effect.runSync(
			presentation.beginFx({
				sourceActorId: "runtime:second",
				swapCandidate,
			}),
		);

		Effect.runSync(
			presentation.completeFx({
				generation: first,
				result: moveResult,
			}),
		);

		const snapshot = Effect.runSync(presentation.readSnapshotFx);
		expect(snapshot.pendingActorIds).toEqual(
			new Set([
				"runtime:second",
			]),
		);
		expect(snapshot.swaps).toEqual([
			expect.objectContaining({
				generation: second,
			}),
		]);
		expect(snapshot.landingActorIds).toEqual(
			new Set([
				moveResult.itemId,
			]),
		);
	});

	it("releases an accepted swap only through its exact generation", () => {
		const presentation = Effect.runSync(createDropPresentationFx());
		const generation = Effect.runSync(
			presentation.beginFx({
				sourceActorId: swapCandidate.source.id,
				swapCandidate,
			}),
		);
		Effect.runSync(
			presentation.completeFx({
				generation,
				result: swapResult,
			}),
		);

		Effect.runSync(presentation.clearSwapFx(generation - 1));
		expect(Effect.runSync(presentation.readSnapshotFx).swaps).toEqual([
			expect.objectContaining({
				candidate: swapCandidate,
				generation,
			}),
		]);

		Effect.runSync(presentation.clearSwapFx(generation));
		expect(Effect.runSync(presentation.readSnapshotFx).swaps).toEqual([]);
	});
});
