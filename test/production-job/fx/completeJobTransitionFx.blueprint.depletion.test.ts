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
	it("keeps repeated random depletion reads pure and conservatively blocks every branch", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnBlueprintFx({
					id: "runtime:depletion-random",
					space: 0,
					itemId: "blueprint:depletion-random",
					x: 0,
					y: 0,
				});
				const before = yield* readRuntimeFx();
				const first = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				const second = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					first,
					second,
				};
			}),
		);

		expect(result.first).toEqual(result.second);
		expect(result.after).toEqual(result.before);
		expect(result.first).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-capacity",
							itemId: "item:depletion-product",
						},
					},
				},
			],
		});
	});

	it("subtracts exactly one depleted owner, including when no lifecycle output exists", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const noOutput = yield* spawnBlueprintFx({
					id: "runtime:depletion-self-no-output",
					space: 0,
					itemId: "blueprint:depletion-self-no-output",
					x: 0,
					y: 0,
				});
				const stack = yield* spawnItemFx({
					id: "runtime:charged-stack",
					itemId: "producer:charged-stack",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 3,
				});
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: noOutput.id,
					runtime,
				});
				const stackLines = yield* readItemDetailLinesFx({
					itemId: stack.id,
					runtime,
				});
				const started = yield* startLineFx({
					ownerItemId: stack.id,
					lineId: "line:producer:charged-stack",
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
