import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import {
	createRootSource,
	createSimpleItem,
} from "~test/game-config/validation/support/gameValidationTestSource";

const uidDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.ItemDuplicateUid);

describe("validateItemUidsFn", () => {
	it("rejects two canonical items that share one immutable UID", async () => {
		const first = createSimpleItem("item:first");
		const second = {
			...createSimpleItem("item:second"),
			uid: first.uid,
		};

		expect(
			await uidDiagnostics({
				[first.id]: first,
				[second.id]: second,
			}),
		).toEqual([
			expect.objectContaining({
				uid: first.uid,
				itemIds: [
					first.id,
					second.id,
				],
				paths: [
					[
						"items",
						first.id,
						"uid",
					],
					[
						"items",
						second.id,
						"uid",
					],
				],
			}),
		]);
	});

	it("accepts distinct immutable UIDs", async () => {
		const first = createSimpleItem("item:first");
		const second = createSimpleItem("item:second");

		expect(
			await uidDiagnostics({
				[first.id]: first,
				[second.id]: second,
			}),
		).toEqual([]);
	});
});
