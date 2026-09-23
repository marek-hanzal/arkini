import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint depleted-owner accounting", () => {
	it("subtracts exactly one depleted owner, including when no lifecycle outcome exists", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const noOutput = yield* spawnBlueprintFx({
					id: "runtime:depletion-self-no-outcome",
					space: 0,
					itemUid: "blueprint:depletion-self-no-outcome",
					x: 0,
					y: 0,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:depleted-owner",
					itemUid: "producer:depleted-owner",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: noOutput.id,
					runtime,
				});
				const stackLines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:depleted-owner",
				}).pipe(Effect.result);
				return {
					lines,
					stackLines,
					started,
				};
			}),
		);

		expect(result.lines).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
				},
			],
		});
		expect(result.stackLines).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "ready",
					},
				},
			],
		});
		expect(Result.isSuccess(result.started)).toBe(true);
	});
});
