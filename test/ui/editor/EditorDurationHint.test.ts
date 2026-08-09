import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { formatEditorDurationFx } from "~/ui/form/formatEditorDurationFx";

describe("formatEditorDuration", () => {
	it.each([
		[
			0,
			"0s",
		],
		[
			1.25,
			"1.25s",
		],
		[
			270,
			"4m 30s",
		],
		[
			3_600,
			"1h",
		],
		[
			90_061,
			"1d 1h 1m 1s",
		],
		[
			-90,
			"-1m 30s",
		],
	])("formats %s seconds as %s", (seconds, expected) => {
		expect(Effect.runSync(formatEditorDurationFx(seconds))).toBe(expected);
	});

	it("omits invalid values", () => {
		expect(Effect.runSync(formatEditorDurationFx(Number.NaN))).toBeUndefined();
	});
});
