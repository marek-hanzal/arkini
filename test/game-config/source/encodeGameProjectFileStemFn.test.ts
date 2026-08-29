import { describe, expect, it } from "vitest";

import { encodeGameProjectFileStemFn } from "~/game-config/source/encodeGameProjectFileStemFn";

describe("encodeGameProjectFileStemFn", () => {
	it("preserves canonical filenames for valid project identities", () => {
		expect(encodeGameProjectFileStemFn("project")).toBe("project");
		expect(encodeGameProjectFileStemFn("project.build")).toBe("project%2Ebuild");
		expect(encodeGameProjectFileStemFn("literal~%20")).toBe("literal~%2520");
		expect(encodeGameProjectFileStemFn("game / č")).toBe("game%20%2F%20%C4%8D");
		expect(encodeGameProjectFileStemFn("emoji-🎮")).toBe("emoji-%F0%9F%8E%AE");
	});

	it("keeps every UTF-16 identity encodable and collision-safe", () => {
		expect(encodeGameProjectFileStemFn("\ud800")).toBe("%ED%A0%80");
		expect(encodeGameProjectFileStemFn("\udc00")).toBe("%ED%B0%80");
		expect(encodeGameProjectFileStemFn("\ud800")).not.toBe(
			encodeGameProjectFileStemFn("\ufffd"),
		);
		expect(encodeGameProjectFileStemFn("\ud800")).not.toBe(
			encodeGameProjectFileStemFn("\u00ed\u00a0\u0080"),
		);
		expect(encodeGameProjectFileStemFn("\ud800")).not.toBe(
			encodeGameProjectFileStemFn("%ED%A0%80"),
		);
		expect(encodeGameProjectFileStemFn("\ud800")).not.toBe(
			encodeGameProjectFileStemFn("\udc00"),
		);
	});
});
