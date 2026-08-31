import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
	weightedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";

const boardItem = (id: "source" | "target", itemId: "source" | "target", x: number) => ({
	id: `runtime:${id}`,
	itemId,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
	quantity: 1,
});

const mergeAttemptFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source");
		const target = before.items.find((item) => item.id === "runtime:target");
		if (source === undefined || target === undefined) {
			return yield* Effect.die(new Error("Expected merge participants."));
		}
		const attempt = yield* Effect.result(
			mergeItemsFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				targetItemId: target.id,
				targetRevision: target.revision,
			}),
		);
		return {
			after: yield* readRuntimeFx(),
			attempt,
			before,
		};
	});

const blockedOutputState = (includeBlocker = true) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			boardItem("source", "source", 0),
			boardItem("target", "target", 1),
			...(includeBlocker
				? [
						{
							id: "runtime:blocker",
							itemId: "blocker",
							location: {
								scope: "inventory" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
							quantity: 1,
						},
					]
				: []),
		],
		jobQueue: [],
		jobs: [],
	}) satisfies StateSchema.Type;

describe("mergeItemsFx atomicity", () => {
	it("rolls back both stacks when an isolated replacement remainder cannot fit", () => {
		const config = createMergeTestConfig({
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "replace",
				result: "result",
			},
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					...boardItem("source", "source", 0),
					quantity: 2,
				},
				{
					...boardItem("target", "target", 1),
					quantity: 2,
				},
				{
					id: "runtime:blocker",
					itemId: "blocker",
					location: {
						scope: "inventory" as const,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				},
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "target",
				remainingQuantity: 1,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rolls back target replacement when a used source cannot return through maxCount", () => {
		const config = createMergeTestConfig({
			sourceMaxCount: 1,
			sourceMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "use",
				effect: "replace",
				result: "source",
			},
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", "source", 0),
				boardItem("target", "target", 1),
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "source",
				reason: "item:max-count",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rolls back source consumption when optional output cannot fit completely", () => {
		const config = createMergeTestConfig({
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			outputMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: guaranteedMergeOutput({
					quantity: 2,
				}),
			},
		});
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state: blockedOutputState(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "output",
				remainingQuantity: 1,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("replays the same random output after a blocked attempt", () => {
		const config = createMergeTestConfig({
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: weightedMergeOutput(),
			},
		});
		const afterRetry = Effect.runSync(
			Effect.gen(function* () {
				const blocked = yield* mergeAttemptFx();
				if (Result.isSuccess(blocked.attempt)) {
					return yield* Effect.die(new Error("Expected the first merge to be blocked."));
				}
				const blocker = blocked.after.items.find((item) => item.id === "runtime:blocker");
				if (blocker === undefined) {
					return yield* Effect.die(new Error("Expected blocker."));
				}
				yield* removeRuntimeItemForTestFx({
					itemId: blocker.id,
					revision: blocker.revision,
				});
				const retry = yield* mergeAttemptFx();
				if (Result.isFailure(retry.attempt))
					return yield* Effect.fail(retry.attempt.failure);
				return retry.after;
			}).pipe(
				useGameFx({
					config,
					state: blockedOutputState(),
				}),
			),
		);
		const firstTry = Effect.runSync(
			Effect.gen(function* () {
				const result = yield* mergeAttemptFx();
				if (Result.isFailure(result.attempt))
					return yield* Effect.fail(result.attempt.failure);
				return result.after;
			}).pipe(
				useGameFx({
					config,
					state: blockedOutputState(false),
				}),
			),
		);

		const outputId = (runtime: typeof afterRetry) =>
			runtime.items.find((item) => item.item.id === "output:a" || item.item.id === "output:b")
				?.item.id;
		expect(outputId(afterRetry)).toBeDefined();
		expect(outputId(afterRetry)).toBe(outputId(firstTry));
	});

	it("lets removed source quantity satisfy maxCount for same-item optional output", () => {
		const config = createMergeTestConfig({
			sourceMaxCount: 1,
			sourceMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: guaranteedMergeOutput({
					itemId: "source",
				}),
			},
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", "source", 0),
				boardItem("target", "target", 1),
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isSuccess(result.attempt)).toBe(true);
		expect(
			result.after.items
				.filter((item) => item.item.id === "source")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(1);
	});
});
