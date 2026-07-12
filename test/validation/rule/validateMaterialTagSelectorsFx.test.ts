import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import type { InputSchema } from "~/v1/input/schema/InputSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const materialTag = (tag: string): ReadonlyArray<InputSchema.Type> => [
	{
		type: "materials",
		selector: {
			type: "tag",
			tag,
		},
		quantity: {
			type: "value",
			value: 1,
		},
		capacity: 0,
		mode: "consume",
	},
];

const tagDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === "input:material-tag-empty");

describe("validateMaterialTagSelectorsFx", () => {
	it("rejects a material tag selector with no canonical candidate", async () => {
		const owner = createProducerItem({
			id: "producer:lumberjack",
			input: materialTag("tag:tree"),
		});

		expect(
			await tagDiagnostics({
				[owner.id]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineId: "line:test",
				inputIndex: 0,
				tag: "tag:tree",
			}),
		]);
	});

	it("accepts a material tag selector matching one or more items", async () => {
		const owner = createProducerItem({
			id: "producer:lumberjack",
			input: materialTag("tag:tree"),
		});
		const tree = createSimpleItem("deposit:tree", [
			"tag:tree",
		]);
		const forest = createSimpleItem("deposit:forest", [
			"tag:tree",
		]);

		expect(
			await tagDiagnostics({
				[owner.id]: owner,
				[tree.id]: tree,
				[forest.id]: forest,
			}),
		).toEqual([]);
	});
});
