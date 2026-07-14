import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const compileLifecycle = async ({
	afterCompletion,
	placement,
}: {
	afterCompletion: "keep" | "remove";
	placement: "drop" | "replace";
}) => {
	const replacement = createSimpleItem("item:replacement");
	const producer = {
		...createProducerItem({
			id: "item:producer",
			output: createOutput([
				{
					itemId: replacement.id,
					placement,
				},
			]),
		}),
		afterCompletion,
	};
	return await Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items: {
					[producer.id]: producer,
					[replacement.id]: replacement,
				},
			}),
		]),
	);
};

const diagnostics = async (props: Parameters<typeof compileLifecycle>[0]) =>
	(await compileLifecycle(props)).diagnostics.filter(
		({ code }) => code === "completion:keep-replace",
	);

describe("validateCompletionLifecycleFx", () => {
	it("rejects replacement output for an owner configured to remain", async () => {
		expect(
			await diagnostics({
				afterCompletion: "keep",
				placement: "replace",
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: "item:producer",
				lineId: "line:test",
				maximum: 1,
			}),
		]);
	});

	it("accepts replacement output when the owner is removed", async () => {
		expect(
			await diagnostics({
				afterCompletion: "remove",
				placement: "replace",
			}),
		).toEqual([]);
	});

	it("accepts ordinary output when the owner remains", async () => {
		expect(
			await diagnostics({
				afterCompletion: "keep",
				placement: "drop",
			}),
		).toEqual([]);
	});
});
