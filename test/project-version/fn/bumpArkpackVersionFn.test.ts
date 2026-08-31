import { describe, expect, it } from "vitest";

import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { bumpArkpackVersionFn } from "~/project-version/fn/bumpArkpackVersionFn";

describe("bumpArkpackVersionFn", () => {
	it("increments schema-valid decimal components without numeric precision or range loss", () => {
		expect(bumpArkpackVersionFn(GameVersionSchema.parse("9007199254740992.0"), "major")).toBe(
			"9007199254740993.0",
		);
		expect(bumpArkpackVersionFn(GameVersionSchema.parse("1.9007199254740992"), "minor")).toBe(
			"1.9007199254740993",
		);

		const hugeComponent = "9".repeat(309);
		expect(bumpArkpackVersionFn(GameVersionSchema.parse(`${hugeComponent}.0`), "major")).toBe(
			`1${"0".repeat(309)}.0`,
		);
		expect(bumpArkpackVersionFn(GameVersionSchema.parse(`1.${hugeComponent}`), "minor")).toBe(
			`1.1${"0".repeat(309)}`,
		);
	});
});
