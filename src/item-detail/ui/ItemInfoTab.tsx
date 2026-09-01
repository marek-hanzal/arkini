import { match } from "ts-pattern";

import type { readItemDetailInfoFn } from "~/item-detail-read/fn/readItemDetailInfoFn";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemStorageScopeLabel, ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";
import { Fact, FactList } from "~/ui/ui/FactList";
import { Scrollable } from "~/ui/ui/Scrollable";

export namespace ItemInfoTab {
	export interface Detail {
		readonly description: string;
		readonly itemType: TypeSchema.Type;
		readonly storageScope: StorageSchema.Type;
		readonly location?: readItemDetailInfoFn.Location;
		readonly currentStack?: number;
		readonly maxStackSize: number;
		readonly ownedQuantity?: number;
		readonly maxCount?: number;
		readonly charges?: {
			readonly label: "Charges" | "Charges per item";
			readonly value: string;
		};
	}
}

const readStackCapacityLabelFn = (maxStackSize: number) =>
	maxStackSize === 1 ? "Single item" : `${maxStackSize} items`;

const readOwnedLabelFn = (ownedQuantity: number, maxCount: number | undefined) =>
	`${ownedQuantity}${maxCount === undefined ? "" : ` / ${maxCount}`}`;

const readGameLimitLabelFn = (maxCount: number | undefined) =>
	maxCount === undefined ? "No configured limit" : `${maxCount}`;

const readLocationLabelFn = (location: readItemDetailInfoFn.Location) =>
	match(location)
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
		.exhaustive();

/** Renders the canonical description-and-facts presentation for configured and live items. */
export const ItemInfoTab = ({ detail }: { readonly detail: ItemInfoTab.Detail }) => {
	const fact = [
		{
			label: "Type",
			value: ItemTypeLabel[detail.itemType],
		},
		...(detail.location === undefined
			? []
			: [
					{
						label: "Location",
						value: readLocationLabelFn(detail.location),
					},
				]),
		{
			label: "Storage",
			value: ItemStorageScopeLabel[detail.storageScope],
		},
		...(detail.currentStack === undefined
			? []
			: [
					{
						label: "Current stack",
						value: `${detail.currentStack} ${detail.currentStack === 1 ? "item" : "items"}`,
					},
				]),
		{
			label: "Stack capacity",
			value: readStackCapacityLabelFn(detail.maxStackSize),
		},
		...(detail.ownedQuantity === undefined
			? []
			: [
					{
						label: "Owned",
						value: readOwnedLabelFn(detail.ownedQuantity, detail.maxCount),
					},
				]),
		{
			label: "Game limit",
			value: readGameLimitLabelFn(detail.maxCount),
		},
		...(detail.charges === undefined
			? []
			: [
					detail.charges,
				]),
	];
	return (
		<Scrollable
			className="h-full pr-1"
			data-ui="ItemInfoTab"
		>
			<section className="pb-5">
				<p
					className="max-w-4xl text-pretty text-base leading-relaxed text-muted"
					data-ui="ItemInfoDescription"
				>
					{detail.description}
				</p>
			</section>

			<section className="border-t border-line pt-2">
				<FactList>
					{fact.map((entry) => (
						<Fact
							key={entry.label}
							dataUi="ItemInfoFact"
							label={entry.label}
							value={entry.value}
						/>
					))}
				</FactList>
			</section>
		</Scrollable>
	);
};
