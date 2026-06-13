import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { defaultSaveGameId } from "~/play/logic/save";
import type { PlayerInventoryView, PlayerResourceView } from "~/play/logic/playTypes";

export const readInventoryFx = Effect.fn("readInventoryFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	const rows = yield* dbFx((db) =>
		db
			.selectFrom(table.playerResource)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.execute(),
	);
	const quantityByResourceId = new Map(
		rows.map((row) => [
			row.resourceDefinitionId,
			row.quantity,
		]),
	);
	const resources = [
		...gameConfig.index.resourcesById.values(),
	]
		.sort((left, right) => left.sort - right.sort)
		.map(
			(resource): PlayerResourceView => ({
				id: resource.id,
				code: resource.code,
				name: resource.name,
				description: resource.description,
				symbol: resource.symbol,
				quantity: quantityByResourceId.get(resource.id) ?? 0,
			}),
		);

	return {
		resources,
		byId: Object.fromEntries(
			resources.map((resource) => [
				resource.id,
				resource,
			]),
		),
	} satisfies PlayerInventoryView;
});
