import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import {
	createLine,
	createProducerItem,
	createRootSource,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const lineDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.LineDuplicateId);

const selectionDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(
		({ code }) => code === DiagnosticCodeEnumSchema.enum.LineMultipleSelections,
	);

describe("validateItemLineIdsFn", () => {
	it("rejects duplicate line IDs within one owner", async () => {
		const owner = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					id: "line:plank",
				}),
				createLine({
					id: "line:plank",
				}),
			],
		});

		expect(
			await lineDiagnostics({
				[owner.uid]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemUid: owner.uid,
				lineId: "line:plank",
				paths: [
					[
						"items",
						owner.uid,
						"lines",
						0,
						"id",
					],
					[
						"items",
						owner.uid,
						"lines",
						1,
						"id",
					],
				],
			}),
		]);
	});

	it("allows the same stable line ID on different owners", async () => {
		const first = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					id: "line:plank",
				}),
			],
		});
		const second = createProducerItem({
			id: "producer:advanced-sawmill",
			lines: [
				createLine({
					id: "line:plank",
				}),
			],
		});

		expect(
			await lineDiagnostics({
				[first.uid]: first,
				[second.uid]: second,
			}),
		).toEqual([]);
	});

	it.each([
		"default",
	] as const)(
		"rejects two authored %s selections with both line identities",
		async (selection) => {
			const owner = createProducerItem({
				id: "producer:sawmill",
				lines: [
					createLine({
						[selection]: true,
						id: "line:plank",
					}),
					createLine({
						[selection]: true,
						id: "line:beam",
					}),
				],
			});

			expect(
				await selectionDiagnostics({
					[owner.uid]: owner,
				}),
			).toEqual([
				expect.objectContaining({
					ownerItemUid: owner.uid,
					lineIds: [
						"line:plank",
						"line:beam",
					],
					paths: [
						[
							"items",
							owner.uid,
							"lines",
							0,
							selection,
						],
						[
							"items",
							owner.uid,
							"lines",
							1,
							selection,
						],
					],
				}),
			]);
		},
	);

	it("accepts multiple weighted Clock lines", async () => {
		const owner = createProducerItem({
			id: "producer:sawmill",
			lines: [
				{
					...createLine({
						id: "line:plank",
						clock: true,
					}),
					clockWeight: 1,
				},
				{
					...createLine({
						id: "line:beam",
						clock: true,
					}),
					clockWeight: 3,
				},
			],
		});
		expect(
			await selectionDiagnostics({
				[owner.uid]: owner,
			}),
		).toEqual([]);
	});

	it("reports the authored-default conflict independently from duplicate line identity", async () => {
		const owner = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					default: true,
					id: "line:plank",
				}),
				createLine({
					default: true,
					id: "line:plank",
				}),
			],
		});

		expect(
			await selectionDiagnostics({
				[owner.uid]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemUid: owner.uid,
				lineIds: [
					"line:plank",
					"line:plank",
				],
				paths: [
					[
						"items",
						owner.uid,
						"lines",
						0,
						"default",
					],
					[
						"items",
						owner.uid,
						"lines",
						1,
						"default",
					],
				],
			}),
		]);
	});
});
