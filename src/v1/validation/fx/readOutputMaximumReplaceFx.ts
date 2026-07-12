import { Effect } from "effect";
import { match } from "ts-pattern";

import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { readQuantityBoundsFx } from "~/v1/quantity/fx/readQuantityBoundsFx";

export namespace readOutputMaximumReplaceFx {
	export interface Props {
		output: OutputSchema.Type;
	}
}

const readDropReplaces = (
	drops: ReadonlyArray<{
		readonly placement: string;
	}>,
) => drops.filter((drop) => drop.placement === "replace").length;

/** Reads the maximum replace drops that one selected output set may emit together. */
export const readOutputMaximumReplaceFx = Effect.fn("readOutputMaximumReplaceFx")(function* ({
	output,
}: readOutputMaximumReplaceFx.Props) {
	const setMaximums = yield* Effect.forEach(output.set, (set) =>
		Effect.reduce(set.roll, 0, (maximum, roll) =>
			match(roll)
				.with(
					{
						type: "guaranteed",
					},
					({ drop }) => Effect.succeed(maximum + readDropReplaces(drop)),
				)
				.with(
					{
						type: "chance",
					},
					({ drop }) => Effect.succeed(maximum + readDropReplaces(drop)),
				)
				.with(
					{
						type: "weight",
					},
					({ drop, quantity }) =>
						Effect.gen(function* () {
							const bounds = yield* readQuantityBoundsFx({
								quantity,
							});
							const candidateMaximum = Math.max(
								...drop.map((candidate) => readDropReplaces(candidate.drop)),
							);

							return maximum + candidateMaximum * bounds.max;
						}),
				)
				.exhaustive(),
		),
	);

	return Math.max(...setMaximums);
});
