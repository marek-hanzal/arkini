import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";

const boardFn = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("merge settlement", () => {
	it("discards termination work when merge removes items for another reason", () => {
		const config = createMergeTestConfig({
			rule: {
				target: {
					type: "item",
					itemUid: "target",
				},
				action: "consume",
				effect: "remove",
			},
			sourceTerminationOutcome: guaranteedMergeOutput(),
			targetTerminationOutcome: guaranteedMergeOutput(),
		});
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "source",
					itemUid: "source",
					location: boardFn(0),
				});
				const target = yield* spawnItemFx({
					id: "target",
					itemUid: "target",
					location: boardFn(1),
				});
				yield* mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(runtime.items).toEqual([]);
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([]);
	});
});
