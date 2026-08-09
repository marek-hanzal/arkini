import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { formatByteSizeFx } from "~/ui/arkpack/editor/formatByteSizeFx";

describe("formatByteSize", () => {
	it.each([
		[
			0,
			"0 bytes",
		],
		[
			1,
			"1 byte",
		],
		[
			999,
			"999 bytes",
		],
		[
			1_000,
			"1 KB",
		],
		[
			2_376_738,
			"2.4 MB",
		],
		[
			1_000_000_000,
			"1 GB",
		],
	])("formats %i bytes as %s", (bytes, expected) => {
		expect(Effect.runSync(formatByteSizeFx(bytes))).toBe(expected);
	});
});
