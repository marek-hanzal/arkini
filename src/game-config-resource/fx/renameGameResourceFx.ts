import { Effect } from "effect";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

/** Renames every canonical authored reference to one exact resource identity. */
export const renameGameResourceFx = Effect.fn("renameGameResourceFx")(function* ({
	config,
	from,
	to,
}: {
	readonly config: GameConfigSchema.Type;
	readonly from: string;
	readonly to: string;
}) {
	const rename = (id: string) => (id === from ? to : id);
	const resources = Object.fromEntries(
		Object.entries(config.resources).map(([role, id]) => [
			role,
			rename(id),
		]),
	);
	const items = Object.fromEntries(
		Object.entries(config.items).map(([id, item]) => [
			id,
			{
				...item,
				asset: {
					...item.asset,
					default: item.asset.default.map(rename),
					sources: item.asset.sources?.map(rename),
				},
			},
		]),
	);
	return yield* Effect.sync(() =>
		GameConfigSchema.parse({
			...config,
			items,
			resources,
		}),
	);
});
