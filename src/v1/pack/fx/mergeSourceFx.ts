import { Effect } from "effect";

import type { GameSourceSchema } from "~/v1/schema/GameSourceSchema";

export const mergeSourceFx = Effect.fn("mergeSourceFx")(function* (
	sources: ReadonlyArray<GameSourceSchema.Type>,
) {
	return sources.reduce<GameSourceSchema.Type>(
		(output, source) => ({
			...output,
			...source,
			categories: {
				...output.categories,
				...source.categories,
			},
			items: {
				...output.items,
				...source.items,
			},
		}),
		{
			categories: {},
			items: {},
		},
	);
});
