import { match } from "ts-pattern";

import type { useItemDetailInfo } from "~/ui/item-detail/useItemDetailInfo";
import {
	ItemInfoFact,
	ItemInfoFacts,
	ItemStorageScopeLabel,
	ItemTypeLabel,
} from "~/ui/item-detail/ItemInfoPresentation";
import { Scrollable } from "~/ui/scrollable/Scrollable";

const LocationInfoFact = ({
	location,
}: {
	readonly location: Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>["location"];
}) => (
	<ItemInfoFact
		dataUi="TileInfoFact"
		label="Location"
		value={match(location)
			.with(
				{
					kind: "board",
				},
				({ space }) => `Board · Space ${space + 1}`,
			)
			.with(
				{
					kind: "inventory",
				},
				() => "Inventory",
			)
			.with(
				{
					kind: "toolbar",
				},
				() => "Toolbar",
			)
			.with(
				{
					kind: "input",
				},
				() => "Stored line input",
			)
			.with(
				{
					kind: "job",
				},
				() => "Consumed by active work",
			)
			.with(
				{
					kind: "reserved",
				},
				() => "Reserved by active work",
			)
			.with(
				{
					kind: "delivery",
				},
				() => "In delivery",
			)
			.exhaustive()}
	/>
);

/** Renders the broad first-pass item facts shared by every canonical item definition. */
export const ItemInfoTab = ({
	info,
	stale = false,
}: {
	readonly info: Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly stale?: boolean;
}) => (
	<Scrollable
		className="h-full pr-1"
		data-ui="ItemInfoTab"
	>
		<section className="pb-5">
			<p
				className="max-w-4xl text-pretty text-base leading-relaxed text-muted"
				data-ui="TileInfoDescription"
			>
				{info.description}
			</p>
		</section>

		<section className="border-t border-line pt-2">
			<ItemInfoFacts>
				<ItemInfoFact
					dataUi="TileInfoFact"
					label="Type"
					value={ItemTypeLabel[info.itemType]}
				/>
				{stale ? null : <LocationInfoFact location={info.location} />}
				<ItemInfoFact
					dataUi="TileInfoFact"
					label="Storage"
					value={ItemStorageScopeLabel[info.storageScope]}
				/>
				{stale ? null : (
					<ItemInfoFact
						dataUi="TileInfoFact"
						label="Current stack"
						value={`${info.quantity} ${info.quantity === 1 ? "item" : "items"}`}
					/>
				)}
				<ItemInfoFact
					dataUi="TileInfoFact"
					label="Stack capacity"
					value={info.maxStackSize === 1 ? "Single item" : `${info.maxStackSize} items`}
				/>
				{stale ? null : (
					<ItemInfoFact
						dataUi="TileInfoFact"
						label="Owned"
						value={`${info.ownedQuantity}${info.maxCount === undefined ? "" : ` / ${info.maxCount}`}`}
					/>
				)}
				<ItemInfoFact
					dataUi="TileInfoFact"
					label="Game limit"
					value={info.maxCount === undefined ? "No configured limit" : `${info.maxCount}`}
				/>
				{stale || info.charges === undefined ? null : (
					<ItemInfoFact
						dataUi="TileInfoFact"
						label="Charges"
						value={`${info.charges.remaining} / ${info.charges.total}`}
					/>
				)}
			</ItemInfoFacts>
		</section>
	</Scrollable>
);
