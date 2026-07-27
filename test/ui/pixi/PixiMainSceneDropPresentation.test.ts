import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiSceneSwapCandidate } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";

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
} satisfies PixiSceneSwapCandidate;

const moveResult = {
	itemId: swapCandidate.source.id,
	kind: "move",
	location: targetLocation,
	previousLocation: sourceLocation,
	revision: "revision:moved",
} satisfies runTileDropAtom.Result;

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
} satisfies runTileDropAtom.Result;

describe("Pixi main-scene drop presentation", () => {
	it("retains independent pending generations when either completes", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
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

	it("clears a captured swap on an accepted non-swap terminal result", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const generation = Effect.runSync(
			presentation.beginFx({
				sourceActorId: swapCandidate.source.id,
				swapCandidate,
			}),
		);

		Effect.runSync(
			presentation.completeFx({
				generation,
				result: moveResult,
			}),
		);

		expect(Effect.runSync(presentation.readSnapshotFx)).toMatchObject({
			swaps: [],
		});
	});

	it("consumes a direct landing hint after its canonical reconciliation", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const generation = Effect.runSync(
			presentation.beginFx({
				sourceActorId: moveResult.itemId,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			presentation.completeFx({
				generation,
				result: moveResult,
			}),
		);

		expect(Effect.runSync(presentation.readSnapshotFx).landingActorIds).toEqual(
			new Set([
				moveResult.itemId,
			]),
		);
		Effect.runSync(
			presentation.reconcileActorIdsFx({
				inventoryActorIds: new Set(),
				mainActorIds: new Set([
					moveResult.itemId,
				]),
			}),
		);
		expect(Effect.runSync(presentation.readSnapshotFx).landingActorIds).toEqual(new Set());
	});

	it("retains an accepted swap until its exact generation is consumed", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
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
		expect(Effect.runSync(presentation.readSnapshotFx).swaps[0]?.candidate).toEqual(
			swapCandidate,
		);

		Effect.runSync(presentation.clearSwapFx(generation));
		expect(Effect.runSync(presentation.readSnapshotFx).swaps).toEqual([]);
	});

	it("retains exact Inventory-consumption feedback through canonical reconciliation", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const generation = Effect.runSync(
			presentation.beginFx({
				sourceActorId: swapCandidate.source.id,
				swapCandidate: null,
			}),
		);
		const storeResult = {
			inventory: {
				itemId: "runtime:inventory",
				location: sourceLocation,
				revision: "revision:inventory",
			},
			kind: "store-inventory",
			source: {
				canonicalItemId: "water",
				current: null,
				itemId: swapCandidate.source.id,
				previousLocation: sourceLocation,
				previousQuantity: 3,
				previousRevision: swapCandidate.source.revision,
			},
		} satisfies runTileDropAtom.Result;
		Effect.runSync(
			presentation.completeFx({
				generation,
				result: storeResult,
			}),
		);

		const snapshot = Effect.runSync(presentation.readSnapshotFx);
		expect(snapshot.hiddenActorIds).toEqual(
			new Set([
				swapCandidate.source.id,
			]),
		);
		expect(snapshot.feedback).toEqual([
			{
				cues: [
					{
						actorId: swapCandidate.source.id,
						key: `drop:${generation}:consume-source`,
						kind: "consume-source",
					},
					{
						actorId: "runtime:inventory",
						key: `drop:${generation}:consume`,
						kind: "consume",
					},
				],
				generation,
			},
		]);

		Effect.runSync(presentation.clearFeedbackFx(generation));
		Effect.runSync(
			presentation.reconcileActorIdsFx({
				inventoryActorIds: new Set(),
				mainActorIds: new Set(),
			}),
		);
		expect(Effect.runSync(presentation.readSnapshotFx)).toMatchObject({
			feedback: [],
			hiddenActorIds: new Set(),
		});
	});

	it("hides an exact fully consumed stack source while retaining receiver feedback", () => {
		const presentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const generation = Effect.runSync(
			presentation.beginFx({
				sourceActorId: swapCandidate.source.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			presentation.completeFx({
				generation,
				result: {
					kind: "stack",
					transferredQuantity: 1,
					source: {
						canonicalItemId: "log",
						current: null,
						itemId: swapCandidate.source.id,
						previousLocation: sourceLocation,
						previousQuantity: 1,
						previousRevision: swapCandidate.source.revision,
					},
					target: {
						canonicalItemId: "log",
						current: {
							canonicalItemId: "log",
							itemId: swapCandidate.target.id,
							location: targetLocation,
							quantity: 2,
							revision: "revision:target-stacked",
						},
						itemId: swapCandidate.target.id,
						previousLocation: targetLocation,
						previousQuantity: 1,
						previousRevision: swapCandidate.target.revision,
					},
				},
			}),
		);

		const snapshot = Effect.runSync(presentation.readSnapshotFx);
		expect(snapshot.hiddenActorIds).toEqual(
			new Set([
				swapCandidate.source.id,
			]),
		);
		expect(snapshot.feedback[0]?.cues).toEqual([
			expect.objectContaining({
				actorId: swapCandidate.source.id,
				kind: "consume-source",
			}),
			expect.objectContaining({
				actorId: swapCandidate.target.id,
				kind: "consume",
			}),
		]);
	});
});
