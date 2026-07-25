import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export namespace renderPixiTileSemanticListFx {
	export interface Props {
		readonly host: HTMLElement;
		readonly items: Iterable<TileActorItem>;
	}
}

const readLocationLabel = (item: TileActorItem) =>
	match(item.location)
		.with(
			{
				scope: "board",
			},
			(location) =>
				`Board ${location.space + 1}, column ${location.position.x + 1}, row ${location.position.y + 1}`,
		)
		.with(
			{
				scope: "toolbar",
			},
			(location) => `Toolbar slot ${location.position.x + 1}`,
		)
		.with(
			{
				scope: "inventory",
			},
			(location) =>
				`Inventory column ${location.position.x + 1}, row ${location.position.y + 1}`,
		)
		.exhaustive();

const readActionLabel = (item: TileActorItem) =>
	match(item.primaryAction)
		.with(
			{
				kind: "none",
			},
			() => "no primary action",
		)
		.with(
			{
				kind: "open-lines",
			},
			() => "opens production lines",
		)
		.with(
			{
				kind: "open-inventory",
			},
			() => "opens Inventory",
		)
		.with(
			{
				kind: "start-default-line",
			},
			() => "starts the default production line",
		)
		.exhaustive();

/** Mirrors retained visual actors into a non-interactive screen-reader list. */
export const renderPixiTileSemanticListFx = Effect.fn("renderPixiTileSemanticListFx")(
	({ host, items }: renderPixiTileSemanticListFx.Props) =>
		Effect.sync(() => {
			const descriptions = Array.from(items, (item) =>
				[
					item.title,
					`quantity ${item.quantity}`,
					readLocationLabel(item),
					item.running ? "production running" : "idle",
					readActionLabel(item),
				].join(", "),
			).sort();
			const signature = descriptions.join("\n");
			if (host.dataset.semanticSignature === signature) return;
			host.dataset.semanticSignature = signature;
			const list = document.createElement("ul");
			for (const description of descriptions) {
				const listItem = document.createElement("li");
				listItem.textContent = description;
				list.append(listItem);
			}
			host.replaceChildren(list);
		}),
);
