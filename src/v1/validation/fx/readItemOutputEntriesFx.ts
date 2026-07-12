import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { ItemOutputEntrySchema } from "../schema/ItemOutputEntrySchema";
import { readItemLineEntriesFx } from "./readItemLineEntriesFx";

export namespace readItemOutputEntriesFx {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads line, lifecycle, stash, and merge outputs owned by one canonical item. */
export const readItemOutputEntriesFx = Effect.fn("readItemOutputEntriesFx")(function* ({
	itemId,
	item,
}: readItemOutputEntriesFx.Props) {
	const lines = yield* readItemLineEntriesFx({
		itemId,
		item,
	});
	const entries: ItemOutputEntrySchema.Type[] = lines.flatMap(({ line, path }) =>
		line.output === undefined
			? []
			: [
					{
						output: line.output,
						path: [
							...path,
							"output",
						],
					} satisfies ItemOutputEntrySchema.Type,
				],
	);

	const directOutput = match(item)
		.with(
			{
				type: P.union("blueprint", "deposit", "stash", "temporary"),
			},
			({ output }) => output,
		)
		.with(
			{
				type: P.union(
					"simple",
					"producer",
					"craft",
					"inventory",
					"memory",
					"cheat:speed",
					"nuke",
					"cheat:inventory",
				),
			},
			() => undefined,
		)
		.exhaustive();

	if (directOutput !== undefined) {
		entries.push({
			output: directOutput,
			path: [
				"items",
				itemId,
				"output",
			],
		});
	}

	for (const [index, merge] of (item.merge ?? []).entries()) {
		if (merge.output === undefined) {
			continue;
		}

		entries.push({
			output: merge.output,
			path: [
				"items",
				itemId,
				"merge",
				index,
				"output",
			],
		});
	}

	return entries;
});
