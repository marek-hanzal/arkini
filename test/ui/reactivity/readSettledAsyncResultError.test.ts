import { Cause, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

describe("readSettledAsyncResultError", () => {
	it("projects only settled typed failures", () => {
		const failure = new Error("typed failure");

		expect(
			Effect.runSync(readSettledAsyncResultErrorFx(AsyncResult.initial())),
		).toBeUndefined();
		expect(
			Effect.runSync(
				readSettledAsyncResultErrorFx(
					AsyncResult.fail(failure, {
						waiting: true,
					}),
				),
			),
		).toBeUndefined();
		expect(Effect.runSync(readSettledAsyncResultErrorFx(AsyncResult.fail(failure)))).toBe(
			failure,
		);
	});

	it("throws defects and interruptions instead of presenting them as domain errors", () => {
		const defectCause = Cause.die(new Error("defect"));
		const interruptCause = Cause.interrupt();

		expect(() =>
			Effect.runSync(readSettledAsyncResultErrorFx(AsyncResult.failure(defectCause))),
		).toThrow(defectCause);
		expect(() =>
			Effect.runSync(readSettledAsyncResultErrorFx(AsyncResult.failure(interruptCause))),
		).toThrow(interruptCause);
	});

	it("preserves a mixed Cause instead of projecting only its first typed failure", () => {
		const mixedCause = Cause.combine(
			Cause.fail(new Error("typed failure")),
			Cause.die(new Error("defect")),
		);

		expect(() =>
			Effect.runSync(readSettledAsyncResultErrorFx(AsyncResult.failure(mixedCause))),
		).toThrow(mixedCause);
	});
});
