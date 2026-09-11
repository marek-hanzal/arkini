import { describe, expect, it } from "vitest";

import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import { VersionSchema } from "~/game-version/schema/VersionSchema";

describe("game version", () => {
	it("round-trips canonical structured parts through external provenance", () => {
		const parts = VersionPartsSchema.parse({
			major: Number.MAX_SAFE_INTEGER,
			minor: 42,
			suffix: "preview.1-a",
		});
		const version = formatVersionFn(parts);

		expect(version).toBe("9007199254740991.42-preview.1-a");
		expect(parseVersionFn(VersionSchema.parse(version))).toEqual(parts);
	});

	it.each([
		"01.0",
		"1.01",
		"1.0-",
		"1.0-with_space",
		"9007199254740992.0",
		"0.9007199254740992",
	])("rejects non-canonical or unsafe external version %s", (version) => {
		expect(VersionSchema.safeParse(version).success).toBe(false);
	});

	it("rejects unknown structured fields and unsafe components", () => {
		expect(
			VersionPartsSchema.safeParse({
				major: 1,
				minor: 0,
				patch: 1,
			}).success,
		).toBe(false);
		expect(
			VersionPartsSchema.safeParse({
				major: Number.MAX_SAFE_INTEGER + 1,
				minor: 0,
			}).success,
		).toBe(false);
	});
});
