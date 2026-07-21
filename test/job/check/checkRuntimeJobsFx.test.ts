import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(2);
const owner = {
	id: "runtime:forge",
	item: config.items.forge,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
	revision: "revision:owner",
} satisfies RuntimeItemSchema.Type;
const job = (id: string, overrides: Partial<RuntimeSchema.Type["jobs"][number]> = {}) => ({
	id,
	ownerItemId: owner.id,
	lineId: "line:forge:run",
	durationMs: 1_000,
	remainingMs: 1_000,
	revision: `revision:${id}`,
	...overrides,
});

describe("checkRuntimeJobsFx", () => {
	it("reports invalid jobs and job-owned material locations", () => {
		const invalidOwner = {
			...owner,
			location: {
				scope: "input",
				ownerItemId: owner.id,
				lineId: "line:forge:run",
				inputIndex: 0,
			},
		} satisfies RuntimeItemSchema.Type;
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				invalidOwner,
				{
					id: "runtime:tool:missing-job",
					item: config.items.tool,
					location: {
						scope: "reserved",
						jobId: "job:missing",
					},
					quantity: 1,
					revision: "revision:tool:missing-job",
				},
			],
			jobs: [
				job("job:valid"),
				job("job:valid"),
				job("job:third"),
				job("job:missing-owner", {
					ownerItemId: "runtime:missing",
				}),
				job("job:missing-line", {
					lineId: "line:missing",
				}),
				job("job:invalid-time", {
					durationMs: 1_000,
					remainingMs: 2_000,
				}),
			],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.issues.map((issue) => issue.type)).toEqual(
			expect.arrayContaining([
				"job:id:duplicate",
				"job:owner-missing",
				"job:owner:multiple-active",
				"job:owner-not-on-grid",
				"job:line-missing",
				"job:queue-exceeded",
				"job:time-invalid",
				"job:material-orphan",
			]),
		);
	});

	it("accepts a queue-only owner as a first-class runtime state", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				{
					id: "job:queued",
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				},
			],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.issues).toEqual([]);
	});
});

it("reports owned runtime state beneath one consumed job material root", () => {
	const consumedRoot = {
		...owner,
		id: "runtime:consumed-root",
		location: {
			scope: "job",
			jobId: "job:outer",
		},
	} satisfies RuntimeItemSchema.Type;
	const runtime = {
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			owner,
			consumedRoot,
			{
				id: "runtime:owned-water",
				item: config.items.water,
				location: {
					scope: "input",
					ownerItemId: consumedRoot.id,
					lineId: "line:forge:run",
					inputIndex: 0,
				},
				quantity: 1,
				revision: "revision:owned-water",
			},
		],
		jobs: [
			job("job:outer"),
		],
	} satisfies RuntimeSchema.Type;
	const result = Effect.runSync(
		checkRuntimeFx({
			runtime,
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.issues).toContainEqual({
		itemId: consumedRoot.id,
		jobId: "job:outer",
		ownedItemIds: [
			"runtime:owned-water",
		],
		ownedJobIds: [],
		requestIds: [],
		type: "job:consumed-material-state",
	});
});
