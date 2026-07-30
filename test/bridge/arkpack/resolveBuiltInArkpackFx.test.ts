import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { BuiltInArkpackResolutionError } from "~/bridge/arkpack/BuiltInArkpackResolutionError";
import { resolveBuiltInArkpackFx } from "~/bridge/arkpack/resolveBuiltInArkpackFx";

const descriptor = (packageId: string, source: ArkpackDescriptor["source"]): ArkpackDescriptor => ({
	packageId,
	contentHash: packageId.padEnd(64, "a").slice(0, 64),
	gameId: packageId,
	title: packageId,
	game: "1",
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
	{
		arkpacks: [
			{
				...descriptor(ArkiniArkpack.packageId, "built-in"),
				gameId: "arkini",
			},
			{
				...descriptor(ArkiniArkpack.packageId, "built-in"),
				gameId: "arkini",
			},
		],
	},
	{
		arkpacks: [
			{
				...descriptor(ArkiniArkpack.packageId, "built-in"),
				gameId: "arkini",
				trust: {
					type: "external",
					reason: "unsigned",
				},
			},
		],
	},
];

describe("resolveBuiltInArkpackFx", () => {
	it("returns exact signed Arkini even beside another official built-in package", async () => {
		const builtIn = {
			...descriptor(ArkiniArkpack.packageId, "built-in"),
			gameId: "arkini",
		};
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
					descriptor("other-official", "built-in"),
					demo,
					builtIn,
				]),
			),
		).resolves.toBe(builtIn);
	});

	it.each(invalidCatalogs)("rejects catalogs without exact signed Arkini", async ({
		arkpacks,
	}) => {
		const result = await Effect.runPromise(Effect.result(resolveBuiltInArkpackFx(arkpacks)));
		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			expect(result.failure).toBeInstanceOf(BuiltInArkpackResolutionError);
			expect(result.failure).toMatchObject({
				packageId: ArkiniArkpack.packageId,
				matchingCount: expect.any(Number),
			});
		}
	});
});
