import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropSchema } from "~/production-output/schema/DropSchema";
import { rollSetFx } from "~/production-output/fx/rollSetFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";

const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const provideUnusedRuntimeFx = Effect.provideService(RuntimeFx, {
	read: Effect.die("This test must not read Runtime."),
});

const createDrop = (itemId: string): DropSchema.Type => {
	return {
		itemId,
		quantity: {
			min: 1,
			max: 1,
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
				origin,
				rollSet: {
					weight: 1,
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
			}).pipe(provideUnusedRuntimeFx),
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
				origin,
				rollSet: {
					weight: 1,
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
				provideUnusedRuntimeFx,
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
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
