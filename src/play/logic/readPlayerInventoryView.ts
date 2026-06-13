import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "./save";
import type { PlayerInventoryView, PlayerResourceView } from "./playTypes";

export async function readPlayerInventoryView(): Promise<PlayerInventoryView> {
	const rows = await db
		.selectFrom(table.playerResource)
		.selectAll()
		.where("saveGameId", "=", defaultSaveGameId)
		.execute();
	const quantityByResourceId = new Map(
		rows.map((row) => [
			row.resourceDefinitionId,
			row.quantity,
		]),
	);
	const resources = [
		...gameDataIndex.resourcesById.values(),
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
	};
}
