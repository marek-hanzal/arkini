import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

import { emptyLocation, occupiedLocation, run, sourceLocation } from "./dropItemFx.test/fixture";

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
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
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
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
			itemId: "runtime:water",
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});
	it("rejects a stale occupied target without swapping either actor", () => {
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
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
			itemId: "runtime:water",
			targetItemId: "runtime:stone",
		});
		expect(result.runtime.items).toEqual([
			result.source,
			result.target,
		]);
	});
});
