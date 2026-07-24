import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { resolveBuiltInArkpackFx } from "~/bridge/arkpack/resolveBuiltInArkpackFx";

const descriptor = (packageId: string, source: ArkpackDescriptor["source"]): ArkpackDescriptor => ({
	packageId,
	contentHash: packageId.padEnd(64, "a").slice(0, 64),
	gameId: packageId,
	title: packageId,
	configVersion: "1",
	compressedSize: 1,
	trust:
		source === "built-in"
			? {
					type: "official",
					keyId: `${packageId}-key`,
				}
			: {
					type: "external",
					reason: "unsigned",
				},
	source,
});

const invalidCatalogs: ReadonlyArray<{
	readonly arkpacks: ReadonlyArray<ArkpackDescriptor>;
}> = [
	{
		arkpacks: [],
	},
	{
		arkpacks: [
			descriptor("first", "built-in"),
			descriptor("second", "built-in"),
		],
	},
];

describe("resolveBuiltInArkpackFx", () => {
	it("returns the only official built-in package without hardcoding its identity", async () => {
		const builtIn = descriptor("official", "built-in");
		const demo: ArkpackDescriptor = {
			...descriptor("demo", "built-in"),
			trust: {
				type: "external",
				reason: "unsigned",
			},
		};
		await expect(
			Effect.runPromise(
				resolveBuiltInArkpackFx([
					descriptor("imported", "imported"),
					demo,
					builtIn,
				]),
			),
		).resolves.toBe(builtIn);
	});

	it.each(invalidCatalogs)("rejects catalogs without exactly one official package", async ({
		arkpacks,
	}) => {
		await expect(Effect.runPromise(resolveBuiltInArkpackFx(arkpacks))).rejects.toThrow(
			"exactly one official built-in package",
		);
	});
});
