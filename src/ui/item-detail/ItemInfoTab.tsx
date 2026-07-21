import { match } from "ts-pattern";

import type { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import type { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { Scrollable } from "~/ui/scrollable/Scrollable";

const itemTypeLabel = {
	blueprint: "Blueprint",
	"cheat:inventory": "Utility sink",
	"cheat:speed": "Speed control",
	craft: "Craft owner",
	deposit: "Resource deposit",
	inventory: "Inventory control",
	nuke: "Reset control",
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

const readLocationLabel = (
	location: Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>["location"],
) =>
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
		.exhaustive();

const readTagLabel = (tag: string) => {
	const era = /^era:(.+)$/u.exec(tag);
	if (era?.[1] !== undefined) return `Era ${era[1]}`;
	return tag
		.replaceAll(":", " ")
		.replaceAll("-", " ")
		.replaceAll("_", " ")
		.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
};

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

/** Renders the broad first-pass item facts shared by every canonical item definition. */
export const ItemInfoTab = ({
	identity,
	info,
}: {
	readonly identity: Extract<
		useItemDetailIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly info: Extract<
		useItemDetailInfo.Projection,
		{
			readonly kind: "available";
		}
	>;
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
					label="Category"
					value={info.categoryTitle ?? identity.subtitle ?? "Uncategorized"}
				/>
				<InfoFact
					label="Type"
					value={itemTypeLabel[info.itemType]}
				/>
				<InfoFact
					label="Location"
					value={readLocationLabel(info.location)}
				/>
				<InfoFact
					label="Storage"
					value={storageScopeLabel[info.storageScope]}
				/>
				<InfoFact
					label="Current stack"
					value={`${info.quantity} ${info.quantity === 1 ? "item" : "items"}`}
				/>
				<InfoFact
					label="Stack capacity"
					value={info.maxStackSize === 1 ? "Single item" : `${info.maxStackSize} items`}
				/>
				<InfoFact
					label="Owned"
					value={`${info.ownedQuantity}${info.maxCount === undefined ? "" : ` / ${info.maxCount}`}`}
				/>
				<InfoFact
					label="Game limit"
					value={info.maxCount === undefined ? "No configured limit" : `${info.maxCount}`}
				/>
				{info.charges === undefined ? null : (
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
							{readTagLabel(tag)}
						</span>
					))}
				</div>
			</section>
		)}
	</Scrollable>
);
