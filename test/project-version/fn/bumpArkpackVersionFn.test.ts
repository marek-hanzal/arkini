import { describe, expect, it } from "vitest";

import { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";
import { bumpArkpackVersionFn } from "~/project-version/fn/bumpArkpackVersionFn";

describe("bumpArkpackVersionFn", () => {
	it("increments schema-valid decimal components without numeric precision or range loss", () => {
		expect(
			bumpArkpackVersionFn(ArkpackVersionSchema.parse("9007199254740992.0"), "major"),
		).toBe("9007199254740993.0");
		expect(
			bumpArkpackVersionFn(ArkpackVersionSchema.parse("1.9007199254740992"), "minor"),
		).toBe("1.9007199254740993");

		const hugeComponent = "9".repeat(309);
		expect(
			bumpArkpackVersionFn(ArkpackVersionSchema.parse(`${hugeComponent}.0`), "major"),
		).toBe(`1${"0".repeat(309)}.0`);
		expect(
			bumpArkpackVersionFn(ArkpackVersionSchema.parse(`1.${hugeComponent}`), "minor"),
		).toBe(`1.1${"0".repeat(309)}`);
	});
});
