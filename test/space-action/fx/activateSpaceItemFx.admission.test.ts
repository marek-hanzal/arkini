import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { activateSpaceItemFx } from "~/space-action/fx/activateSpaceItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { board, inventory, run, spawnAndActivate } from "../support/spaceActionFixture";

describe("Space item activation admission", () => {
	it("evaluates proximity-gated availability from the Space item's Board origin", () => {
		const near = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:near-permit",
					itemId: "permit",
					location: board(1),
					quantity: 1,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:near-portal",
					itemId: "proximityPortal",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				yield* activateSpaceItemFx({
					currentSpace: before.currentSpace,
					itemId: portal.id,
					location: portal.location,
					revision: portal.revision,
				});
				return yield* readRuntimeFx();
			}),
		);
		expect(near.currentSpace).toBe(10);

		const far = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:far-permit",
					itemId: "permit",
					location: board(3),
					quantity: 1,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:far-portal",
					itemId: "proximityPortal",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: before.currentSpace,
						itemId: portal.id,
						location: portal.location,
						revision: portal.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(far.attempt)).toBe(true);
		expect(far.after).toEqual(far.before);
	});

	it("rejects a zero-count Board rule without a real Board origin", () => {
		const result = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:passive-zero-rule-portal",
					itemId: "passiveZeroBoardRulePortal",
					location: inventory(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: before.currentSpace,
						itemId: portal.id,
						location: portal.location,
						revision: portal.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "BoardQueryOriginUnavailableError",
				origin: inventory(0),
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects a Board source outside the currently visible space", () => {
		const result = run(
			Effect.gen(function* () {
				const item = yield* spawnItemFx({
					id: "runtime:hidden-portal",
					itemId: "portal",
					location: board(0, 0, 1),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: before.currentSpace,
						itemId: item.id,
						location: item.location,
						revision: item.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
				fromSpace: 1,
				toSpace: 0,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects a passive command observed on a stale current space", () => {
		const result = run(
			Effect.gen(function* () {
				const item = yield* spawnItemFx({
					id: "runtime:stale-passive-portal",
					itemId: "chargedPortal",
					location: inventory(1),
					quantity: 1,
				});
				const observed = yield* readRuntimeFx();
				yield* spawnAndActivate({
					id: "runtime:navigator",
					itemId: "portal",
					location: inventory(0),
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: observed.currentSpace,
						itemId: item.id,
						location: item.location,
						revision: item.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "CurrentSpaceConflictError",
				actualSpace: 7,
				expectedSpace: 0,
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
