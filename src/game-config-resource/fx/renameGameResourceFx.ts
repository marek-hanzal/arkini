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
	const renameFn = (id: string) => (id === from ? to : id);
	const resources = Object.fromEntries(
		Object.entries(config.resources).map(([role, id]) => [
			role,
			renameFn(id),
		]),
	);
	const items = Object.fromEntries(
		Object.entries(config.items).map(([id, item]) => [
			id,
			{
				...item,
				lines: item.lines.map((line) =>
					line.artwork === undefined
						? line
						: {
								...line,
								artwork: renameFn(line.artwork),
							},
				),
				...(item.music === undefined
					? {}
					: {
							music: renameFn(item.music),
						}),
				artwork: {
					...item.artwork,
					default: item.artwork.default.map(renameFn),
				},
			},
		]),
	);
	return yield* Effect.sync(() =>
		GameConfigSchema.parse({
			...config,
			items,
			...(config.music === undefined
				? {}
				: {
						music: {
							...config.music,
							playlist: config.music.playlist.map(renameFn),
						},
					}),
			...(config.sfx === undefined
				? {}
				: {
						sfx: {
							...config.sfx,
							events: Object.fromEntries(
								Object.entries(config.sfx.events).map(([event, id]) => [
									event,
									renameFn(id),
								]),
							),
						},
					}),
			resources,
		}),
	);
});
