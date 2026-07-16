import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig();
const job = {
	id: "job:outer",
	ownerItemId: "runtime:owner",
	lineId: "line:forge:run",
	durationMs: 1_000,
	remainingMs: 500,
};
const owner = {
	id: "runtime:owner",
	itemId: "forge",
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
};
const consumedRoot = {
	id: "runtime:consumed-root",
	itemId: "forge",
	location: {
		scope: "job" as const,
		jobId: job.id,
	},
	quantity: 1,
};

describe("fromStateFx job material invariants", () => {
	it("accepts the canonical empty consumed root produced by authoritative start", () => {
		const state = {
			currentSpace: 0,
			items: [
				owner,
				consumedRoot,
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const runtime = Effect.runSync(
			fromStateFx({
				state,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items.find((item) => item.id === consumedRoot.id)?.location).toEqual(
			consumedRoot.location,
		);
	});

	it("hydrates one stateful reserved instance with its passive owned subtree intact", () => {
		const chargedConfig = createJobTestConfig();
		const worker = chargedConfig.items.forge;
		if (worker.type !== "producer") throw new Error("Expected producer fixture.");
		worker.charges = {
			amount: 2,
		};
		const state = {
			currentSpace: 0,
			items: [
				owner,
				{
					id: "runtime:reserved-worker",
					itemId: "forge",
					location: {
						scope: "reserved" as const,
						jobId: job.id,
					},
					remainingCharges: 1,
					quantity: 1,
				},
				{
					id: "runtime:reserved-water",
					itemId: "water",
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:reserved-worker",
						lineId: "line:forge:run",
						inputIndex: 0,
					},
					quantity: 1,
				},
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const runtime = Effect.runSync(
			fromStateFx({
				state,
			}).pipe(
				useGameFx({
					config: chargedConfig,
				}),
			),
		);

		expect(runtime.items.find((item) => item.id === "runtime:reserved-worker")).toMatchObject({
			remainingCharges: 1,
			location: {
				scope: "reserved",
				jobId: job.id,
			},
		});
		expect(
			runtime.items.find((item) => item.id === "runtime:reserved-water")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:reserved-worker",
		});
	});

	it("rejects persisted consumed roots that still own runtime state", () => {
		const state = {
			currentSpace: 0,
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:owned-water",
					itemId: "water",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineId: "line:forge:run",
						inputIndex: 0,
					},
					quantity: 1,
				},
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							type: "job:consumed-material-state",
						}),
					]),
				},
			});
		}
	});
	it("rejects persisted consumed roots with nested owned descendants", () => {
		const state = {
			currentSpace: 0,
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:nested-owner",
					itemId: "forge",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineId: "line:forge:run",
						inputIndex: 1,
					},
					quantity: 1,
				},
				{
					id: "runtime:nested-water",
					itemId: "water",
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:nested-owner",
						lineId: "line:forge:run",
						inputIndex: 0,
					},
					quantity: 1,
				},
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							ownedItemIds: expect.arrayContaining([
								"runtime:nested-owner",
								"runtime:nested-water",
							]),
							type: "job:consumed-material-state",
						}),
					]),
				},
			});
		}
	});

	it("rejects persisted committed work beneath one consumed root", () => {
		const childJob = {
			id: "job:nested",
			ownerItemId: "runtime:nested-owner",
			lineId: "line:forge:run",
			durationMs: 1_000,
			remainingMs: 500,
		};
		const state = {
			currentSpace: 0,
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:nested-owner",
					itemId: "forge",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineId: "line:forge:run",
						inputIndex: 1,
					},
					quantity: 1,
				},
				{
					id: "runtime:nested-material",
					itemId: "tool",
					location: {
						scope: "reserved" as const,
						jobId: childJob.id,
					},
					quantity: 1,
				},
			],
			jobs: [
				job,
				childJob,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							ownedJobIds: [
								childJob.id,
							],
							type: "job:consumed-material-state",
						}),
					]),
				},
			});
		}
	});
});
