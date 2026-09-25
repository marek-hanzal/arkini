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
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.LineDuplicateUid);

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

describe("validateItemLineUidsFn", () => {
	it("rejects duplicate line UIDs within one owner", async () => {
		const owner = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					uid: "line:plank",
				}),
				createLine({
					uid: "line:plank",
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
				lineUid: "line:plank",
				paths: [
					[
						"items",
						owner.uid,
						"lines",
						0,
						"uid",
					],
					[
						"items",
						owner.uid,
						"lines",
						1,
						"uid",
					],
				],
			}),
		]);
	});

	it("rejects the same line UID on different owners with both exact source paths", async () => {
		const first = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					uid: "line:plank",
				}),
			],
		});
		const second = createProducerItem({
			id: "producer:advanced-sawmill",
			lines: [
				createLine({
					uid: "line:plank",
				}),
			],
		});

		expect(
			await lineDiagnostics({
				[first.uid]: first,
				[second.uid]: second,
			}),
		).toEqual([
			expect.objectContaining({
				code: "line:duplicate-uid",
				severity: "error",
				ownerItemUid: second.uid,
				lineUid: "line:plank",
				path: [
					"items",
					second.uid,
					"lines",
					0,
					"uid",
				],
				paths: [
					[
						"items",
						first.uid,
						"lines",
						0,
						"uid",
					],
					[
						"items",
						second.uid,
						"lines",
						0,
						"uid",
					],
				],
			}),
		]);
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
						uid: "line:plank",
					}),
					createLine({
						[selection]: true,
						uid: "line:beam",
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
					lineUids: [
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
						uid: "line:plank",
						clock: "clock-interval",
					}),
					clockWeight: 1,
				},
				{
					...createLine({
						uid: "line:beam",
						clock: "clock-interval",
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
					uid: "line:plank",
				}),
				createLine({
					default: true,
					uid: "line:plank",
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
				lineUids: [
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
