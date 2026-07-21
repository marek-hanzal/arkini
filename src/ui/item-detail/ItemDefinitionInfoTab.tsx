import type { useItemDefinitionDetail } from "~/bridge/item-detail/useItemDefinitionDetail";
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
		useItemDefinitionDetail.Projection,
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
		useItemDefinitionDetail.Projection,
		{
			readonly kind: "available";
		}
	>["storageScope"],
	string
>;

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
	<div className="grid min-w-0 gap-1 border-b border-line/70 py-3 last:border-b-0">
		<dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
		<dd className="min-w-0 text-pretty text-sm font-medium leading-snug text-foreground">
			{value}
		</dd>
	</div>
);

/** Renders authored facts for a configured item reference without pretending a live stack exists. */
export const ItemDefinitionInfoTab = ({
	definition,
}: {
	readonly definition: Extract<
		useItemDefinitionDetail.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<Scrollable
		className="h-full pr-1"
		data-ui="ItemDefinitionInfoTab"
	>
		<section className="pb-5">
			<p className="max-w-4xl text-pretty text-base leading-relaxed text-muted">
				{definition.description}
			</p>
		</section>
		<section className="border-t border-line pt-2">
			<dl className="grid min-w-0 grid-cols-2 gap-x-8 max-[48rem]:grid-cols-1">
				<InfoFact
					label="Category"
					value={definition.categoryTitle ?? definition.subtitle ?? "Uncategorized"}
				/>
				<InfoFact
					label="Type"
					value={itemTypeLabel[definition.itemType]}
				/>
				<InfoFact
					label="Storage"
					value={storageScopeLabel[definition.storageScope]}
				/>
				<InfoFact
					label="Stack capacity"
					value={
						definition.maxStackSize === 1
							? "Single item"
							: `${definition.maxStackSize} items`
					}
				/>
				<InfoFact
					label="Owned"
					value={`${definition.ownedQuantity}${definition.maxCount === undefined ? "" : ` / ${definition.maxCount}`}`}
				/>
				<InfoFact
					label="Game limit"
					value={
						definition.maxCount === undefined
							? "No configured limit"
							: `${definition.maxCount}`
					}
				/>
				{definition.totalCharges === undefined ? null : (
					<InfoFact
						label="Charges per item"
						value={`${definition.totalCharges}`}
					/>
				)}
			</dl>
		</section>
		{definition.tags.length === 0 ? null : (
			<section className="border-t border-line pt-5">
				<h3 className="text-sm font-semibold">Traits</h3>
				<div className="mt-3 flex flex-wrap gap-2">
					{definition.tags.map((tag) => (
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
