import { match } from "ts-pattern";

import type { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { Scrollable } from "~/ui/scrollable/Scrollable";

const itemTypeLabel = {
	blueprint: "Blueprint",
	craft: "Craft owner",
	deposit: "Resource deposit",
	inventory: "Inventory control",
	producer: "Producer",
	simple: "Simple item",
	stash: "Stash",
	temporary: "Temporary item",
} as const satisfies Record<
	Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>["itemType"],
	string
>;

const storageScopeLabel = {
	any: "Board, Inventory & Toolbar",
	board: "Board only",
	inventory: "Inventory only",
	toolbar: "Toolbar only",
} as const satisfies Record<
	Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>["storageScope"],
	string
>;

const InfoFact = ({ label, value }: { readonly label: string; readonly value: string }) => (
	<div
		className="grid min-w-0 gap-1 border-b border-line/70 py-3 last:border-b-0"
		data-ui="TileInfoFact"
		data-label={label}
	>
		<dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
		<dd className="min-w-0 text-pretty text-sm font-medium leading-snug text-foreground">
			{value}
		</dd>
	</div>
);

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
	<InfoFact
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

const TagLabel = ({ tag }: { readonly tag: string }) => {
	const era = /^era:(.+)$/u.exec(tag);
	if (era?.[1] !== undefined) return <>Era {era[1]}</>;
	return (
		<>
			{tag
				.replaceAll(":", " ")
				.replaceAll("-", " ")
				.replaceAll("_", " ")
				.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())}
		</>
	);
};

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
			<dl className="grid min-w-0 grid-cols-2 gap-x-8 max-[48rem]:grid-cols-1">
				<InfoFact
					label="Type"
					value={itemTypeLabel[info.itemType]}
				/>
				{stale ? null : <LocationInfoFact location={info.location} />}
				<InfoFact
					label="Storage"
					value={storageScopeLabel[info.storageScope]}
				/>
				{stale ? null : (
					<InfoFact
						label="Current stack"
						value={`${info.quantity} ${info.quantity === 1 ? "item" : "items"}`}
					/>
				)}
				<InfoFact
					label="Stack capacity"
					value={info.maxStackSize === 1 ? "Single item" : `${info.maxStackSize} items`}
				/>
				{stale ? null : (
					<InfoFact
						label="Owned"
						value={`${info.ownedQuantity}${info.maxCount === undefined ? "" : ` / ${info.maxCount}`}`}
					/>
				)}
				<InfoFact
					label="Game limit"
					value={info.maxCount === undefined ? "No configured limit" : `${info.maxCount}`}
				/>
				{stale || info.charges === undefined ? null : (
					<InfoFact
						label="Charges"
						value={`${info.charges.remaining} / ${info.charges.total}`}
					/>
				)}
			</dl>
		</section>

		{info.tags.length === 0 ? null : (
			<section className="border-t border-line pt-5">
				<h3 className="text-sm font-semibold">Traits</h3>
				<div
					className="mt-3 flex flex-wrap gap-2"
					data-ui="TileInfoTraits"
				>
					{info.tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted"
						>
							<TagLabel tag={tag} />
						</span>
					))}
				</div>
			</section>
		)}
	</Scrollable>
);
