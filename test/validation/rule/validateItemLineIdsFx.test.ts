import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import {
	createLine,
	createProducerItem,
	createRootSource,
} from "~test/validation/support/gameValidationTestSource";

const lineDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === "line:duplicate-id");

describe("validateItemLineIdsFx", () => {
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
});
