import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ItemLineRow } from "~/ui/item-detail/ItemLineRow";
import { useItemLineSearch } from "~/ui/item-detail/useItemLineSearch";
import { Scrollable } from "~/ui/scrollable/Scrollable";

/** Renders the authoritative visible product-line overview inside Item Detail. */
export const ItemLinesTab = ({
	disabled = false,
	lines,
}: {
	readonly disabled?: boolean;
	readonly lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => {
	const { filteredLines, normalizedQuery, query, setQuery } = useItemLineSearch(lines);
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemLinesTab"
		>
			<div
				className="mb-3 shrink-0"
				data-ui="ItemLinesSearch"
			>
				<input
					type="search"
					value={query}
					className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search lines…"
					aria-label="Search visible lines"
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
			</div>
			<Scrollable className="flex-1 pr-1">
				{lines.line.length === 0 ? (
					<div className="grid min-h-48 place-items-center border border-dashed border-line text-sm text-muted">
						No product line is currently visible.
					</div>
				) : filteredLines.length === 0 ? (
					<div
						className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted"
						data-ui="ItemLinesSearchEmpty"
					>
						No visible lines match “{normalizedQuery}”.
					</div>
				) : (
					<div
						className="ak-list grid gap-1"
						data-ui="TileLinesList"
					>
						{filteredLines.map((line) => (
							<ItemLineRow
								key={line.lineId}
								disabled={disabled}
								line={line}
								ownerItemId={lines.itemId}
							/>
						))}
					</div>
				)}
			</Scrollable>
		</div>
	);
};
