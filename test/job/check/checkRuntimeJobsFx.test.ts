import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(2);
const owner = {
	id: "runtime:forge",
	item: config.items.forge,
	location: {
		scope: "board",
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
	startedAtMs: 1_000,
	dueAtMs: 2_000,
	revision: `revision:${id}`,
	...overrides,
});

describe("checkRuntimeJobsFx", () => {
	it("reports invalid jobs and job-owned material locations", () => {
		const runtime = {
			items: [
				owner,
				{
					id: "runtime:tool:missing-job",
					item: config.items.tool,
					location: {
						scope: "job",
						jobId: "job:missing",
						returnLocation: {
							scope: "input",
							ownerItemId: owner.id,
							lineId: "line:forge:run",
							inputIndex: 1,
							returnLocation: {
								scope: "board",
								position: {
									x: 1,
									y: 0,
								},
							},
						},
					},
					quantity: 1,
					revision: "revision:tool:missing-job",
				},
				{
					id: "runtime:tool:mismatch",
					item: config.items.tool,
					location: {
						scope: "job",
						jobId: "job:valid",
						returnLocation: {
							scope: "input",
							ownerItemId: "runtime:other",
							lineId: "line:forge:run",
							inputIndex: 1,
							returnLocation: {
								scope: "board",
								position: {
									x: 2,
									y: 0,
								},
							},
						},
					},
					quantity: 1,
					revision: "revision:tool:mismatch",
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
					startedAtMs: 3_000,
					dueAtMs: 2_000,
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
				"job:line-missing",
				"job:queue-exceeded",
				"job:time-invalid",
				"job:reservation-missing",
				"job:reservation-mismatch",
			]),
		);
	});
});
