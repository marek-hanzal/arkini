import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

const config = createJobTestConfig();
const job = {
	id: "job:outer",
	ownerItemId: "runtime:owner",
	lineUid: "line:forge:run",
	durationMs: 1_000,
	remainingMs: 500,
};
const owner = {
	id: "runtime:owner",
	itemUid: "forge",
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
};
const consumedRoot = {
	id: "runtime:consumed-root",
	itemUid: "water",
	location: {
		scope: "job" as const,
		jobId: job.id,
		inputIndex: 0,
	},
};

describe("fromStateFx job material invariants", () => {
	it("accepts the canonical empty consumed root produced by authoritative start", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
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

	it("rejects persisted consumed roots that still own runtime state", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:owned-water",
					itemUid: "water",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineUid: "line:forge:run",
						inputIndex: 0,
					},
				},
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.result(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							type: RuntimeCheckIssueEnumSchema.enum.JobConsumedMaterialState,
						}),
					]),
				},
			});
		}
	});
	it("rejects persisted consumed roots with nested owned descendants", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:nested-owner",
					itemUid: "forge",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineUid: "line:forge:run",
						inputIndex: 1,
					},
				},
				{
					id: "runtime:nested-water",
					itemUid: "water",
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:nested-owner",
						lineUid: "line:forge:run",
						inputIndex: 0,
					},
				},
			],
			jobs: [
				job,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.result(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							ownedItemIds: expect.arrayContaining([
								"runtime:nested-owner",
								"runtime:nested-water",
							]),
							type: RuntimeCheckIssueEnumSchema.enum.JobConsumedMaterialState,
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
			lineUid: "line:forge:run",
			durationMs: 1_000,
			remainingMs: 500,
		};
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				owner,
				consumedRoot,
				{
					id: "runtime:nested-owner",
					itemUid: "forge",
					location: {
						scope: "input" as const,
						ownerItemId: consumedRoot.id,
						lineUid: "line:forge:run",
						inputIndex: 1,
					},
				},
				{
					id: "runtime:nested-material",
					itemUid: "tool",
					location: {
						scope: "reserved" as const,
						jobId: childJob.id,
						inputIndex: 1,
					},
				},
			],
			jobs: [
				job,
				childJob,
			],
			jobQueue: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.result(
				fromStateFx({
					state,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							itemId: consumedRoot.id,
							ownedJobIds: [
								childJob.id,
							],
							type: RuntimeCheckIssueEnumSchema.enum.JobConsumedMaterialState,
						}),
					]),
				},
			});
		}
	});
});

it("hydrates one stateful reserved instance with its passive owned subtree intact", () => {
	const spentConfig = createJobTestConfig();
	const worker = spentConfig.items.forge;
	const reservedInput = worker.lines[0].input[1];
	if (reservedInput.type !== "materials") throw new Error("Expected material fixture.");
	reservedInput.query.selector = {
		type: "item",
		itemUid: "forge",
	};
	worker.units = {
		amount: 2,
	};
	const state = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			owner,
			{
				id: "runtime:reserved-worker",
				itemUid: "forge",
				location: {
					scope: "reserved" as const,
					jobId: job.id,
					inputIndex: 1,
				},
				remainingUnits: 1,
			},
			{
				id: "runtime:reserved-water",
				itemUid: "water",
				location: {
					scope: "input" as const,
					ownerItemId: "runtime:reserved-worker",
					lineUid: "line:forge:run",
					inputIndex: 0,
				},
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
				config: spentConfig,
			}),
		),
	);

	expect(runtime.items.find((item) => item.id === "runtime:reserved-worker")).toMatchObject({
		remainingUnits: 1,
		location: {
			scope: "reserved",
			jobId: job.id,
			inputIndex: 1,
		},
	});
	expect(
		runtime.items.find((item) => item.id === "runtime:reserved-water")?.location,
	).toMatchObject({
		scope: "input",
		ownerItemId: "runtime:reserved-worker",
	});
});
