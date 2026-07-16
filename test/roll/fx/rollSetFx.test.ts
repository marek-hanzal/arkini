import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { rollSetFx } from "~/engine/roll/fx/rollSetFx";

const createDrop = (itemId: string): DropSchema.Type => {
	return {
		itemId,
		quantity: {
			type: "value",
			value: 1,
		},
		placement: "drop",
		rules: [],
	};
};

describe("rollSetFx", () => {
	it("evaluates every roll and preserves authored drop order", () => {
		const first = createDrop("item:first");
		const second = createDrop("item:second");
		const third = createDrop("item:third");
		const result = Effect.runSync(
			rollSetFx({
				rollSet: {
					roll: [
						{
							type: "guaranteed",
							drop: [
								first,
								second,
							],
						},
						{
							type: "guaranteed",
							drop: [
								third,
							],
						},
					],
				},
			}),
		);

		expect(result.drop).toEqual([
			first,
			second,
			third,
		]);
	});

	it("accepts an empty aggregate when every roll selects no drops", () => {
		const result = Effect.runSync(
			rollSetFx({
				rollSet: {
					roll: [
						{
							type: "chance",
							chance: 0.25,
							drop: [
								createDrop("item:missed"),
							],
						},
					],
				},
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
					]),
				),
			),
		);

		expect(result).toEqual({
			drop: [],
		});
	});
});
