import { describe, expect, it } from "vitest";

import { JobSchema } from "~/engine/job/schema/JobSchema";
import { JobLocationSchema } from "~/engine/location/schema/JobLocationSchema";
import { ReservedLocationSchema } from "~/engine/location/schema/ReservedLocationSchema";

const job = {
	id: "job:test",
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
	durationMs: 1_000,
	remainingMs: 1_000,
};

describe("JobSchema", () => {
	it("accepts one active job and its consumed and reserved material locations", () => {
		expect(JobSchema.parse(job)).toEqual(job);
		expect(
			JobLocationSchema.parse({
				scope: "job",
				jobId: job.id,
			}),
		).toEqual({
			scope: "job",
			jobId: job.id,
		});
		expect(
			ReservedLocationSchema.parse({
				scope: "reserved",
				jobId: job.id,
			}),
		).toEqual({
			scope: "reserved",
			jobId: job.id,
		});
	});
});
