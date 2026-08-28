import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createDropPresentationFx } from "~/ui/pixi/drop/createDropPresentationFx";

import { moveResult, swapCandidate, swapResult } from "./DropPresentation.test/fixture";

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
