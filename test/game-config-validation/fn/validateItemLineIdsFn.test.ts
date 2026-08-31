import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import {
	createLine,
	createProducerItem,
	createRootSource,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";

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

const defaultDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.LineMultipleDefaults);

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
				[owner.id]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineId: "line:plank",
				paths: [
					[
						"items",
						owner.id,
						"lines",
						0,
						"id",
					],
					[
						"items",
						owner.id,
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
				[first.id]: first,
				[second.id]: second,
			}),
		).toEqual([]);
	});

	it("rejects two authored defaults on one owner with both line identities", async () => {
		const owner = createProducerItem({
			id: "producer:sawmill",
			lines: [
				createLine({
					default: true,
					id: "line:plank",
				}),
				createLine({
					default: true,
					id: "line:beam",
				}),
			],
		});

		expect(
			await defaultDiagnostics({
				[owner.id]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineIds: [
					"line:plank",
					"line:beam",
				],
				paths: [
					[
						"items",
						owner.id,
						"lines",
						0,
						"default",
					],
					[
						"items",
						owner.id,
						"lines",
						1,
						"default",
					],
				],
			}),
		]);
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
			await defaultDiagnostics({
				[owner.id]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineIds: [
					"line:plank",
					"line:plank",
				],
				paths: [
					[
						"items",
						owner.id,
						"lines",
						0,
						"default",
					],
					[
						"items",
						owner.id,
						"lines",
						1,
						"default",
					],
				],
			}),
		]);
	});
});
