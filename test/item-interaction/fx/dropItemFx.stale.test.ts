import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { DropItemIgnoredReason } from "~/item-interaction/type/DropItemResult";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";

import { emptyLocation, occupiedLocation, run, sourceLocation } from "../support/dropItemFixture";

describe("dropItemFx / stale and ignored identity", () => {
	it("ignores the same location without revising the item", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: sourceLocation,
						occupant: {
							itemId: source.id,
							revision: source.revision,
						},
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					source,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKind.Ignored,
			reason: DropItemIgnoredReason.SameLocation,
			itemId: "runtime:water",
			location: sourceLocation,
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});
	it("rejects a stale source location instead of moving from a different live slot", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: occupiedLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					source,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.StaleSource,
			itemId: "runtime:water",
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});
	it("rejects a stale occupied target before exact input admission", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						inputStore: {
							lineId: "line:missing",
							inputIndex: 0,
							quantity: 1,
						},
						occupant: {
							itemId: target.id,
							revision: "revision:stale",
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
					source,
					target,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.StaleTarget,
			itemId: "runtime:water",
			targetItemId: "runtime:stone",
		});
		expect(result.runtime.items).toEqual([
			result.source,
			result.target,
		]);
	});
});
