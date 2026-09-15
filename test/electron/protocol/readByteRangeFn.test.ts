import { describe, expect, it } from "vitest";

import { readByteRangeFn } from "~electron/protocol/readByteRangeFn";

describe("readByteRangeFn", () => {
	it("resolves open, bounded, and suffix ranges", () => {
		expect(readByteRangeFn("bytes=2-", 10)).toEqual({
			end: 9,
			length: 8,
			start: 2,
			type: "partial",
		});
		expect(readByteRangeFn("bytes=2-5", 10)).toEqual({
			end: 5,
			length: 4,
			start: 2,
			type: "partial",
		});
		expect(readByteRangeFn("bytes=-3", 10)).toEqual({
			end: 9,
			length: 3,
			start: 7,
			type: "partial",
		});
	});

	it("rejects invalid and unsatisfiable ranges", () => {
		expect(readByteRangeFn("bytes=10-", 10)).toEqual({
			type: "invalid",
		});
		expect(readByteRangeFn("bytes=4-2", 10)).toEqual({
			type: "invalid",
		});
		expect(readByteRangeFn("bytes=0-1,4-5", 10)).toEqual({
			type: "invalid",
		});
	});
});
