import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { resolveOwnerJobQueueFx } from "~/v1/job/fx/read/resolveOwnerJobQueueFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
const jobs = [
	{
		id: "job:first",
		ownerItemId: "runtime:forge",
		lineId: "line:forge:run",
		durationMs: 1_000,
		remainingMs: 500,
		revision: "revision:first",
	},
	{
		id: "job:ready",
		ownerItemId: "runtime:forge",
		lineId: "line:forge:run",
		durationMs: 1_000,
		remainingMs: 0,
		revision: "revision:ready",
	},
	{
		id: "job:other",
		ownerItemId: "runtime:other",
		lineId: "line:other:run",
		durationMs: 1_000,
		remainingMs: 500,
		revision: "revision:other",
	},
] satisfies JobSchema.Type[];
describe("resolveOwnerJobQueueFx", () => {
	it("derives active job state from remaining time without timestamps", () => {
		const result = Effect.runSync(
			resolveOwnerJobQueueFx({
				jobs,
				ownerItemId: "runtime:forge",
			}),
		);
		expect(result.map(({ status }) => status)).toEqual([
			"running",
			"ready",
		]);
		expect(result.map(({ job }) => job.id)).toEqual([
			"job:first",
			"job:ready",
		]);
	});
});
