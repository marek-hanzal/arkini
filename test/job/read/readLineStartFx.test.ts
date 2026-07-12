import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readLineStartFx } from "~/v1/job/read/readLineStartFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

describe("readLineStartFx", () => {
	it("declares line run and queue readiness without starting a job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				return yield* readLineStartFx(props);
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.ready).toBe(true);
		expect(result.run.ready).toBe(true);
		expect(result.run.plan).toBeDefined();
		expect(result.queue).toMatchObject({
			used: 0,
			capacity: 2,
			available: true,
			jobs: [],
		});
	});

	it("keeps the run ready while declaring a full queue as not startable", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const started = yield* startLineFx(props);
				const resolution = yield* readLineStartFx(props);
				return {
					resolution,
					started,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(1),
				}),
			),
		);

		expect(result.resolution.run.ready).toBe(true);
		expect(result.resolution.ready).toBe(false);
		expect(result.resolution.queue).toMatchObject({
			used: 1,
			capacity: 1,
			available: false,
		});
		expect(result.started.type).toBe("started");
		if (result.started.type === "started") {
			expect(result.resolution.queue.jobs).toEqual([
				result.started.job,
			]);
		}
	});
});
