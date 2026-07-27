import type { ReactNode } from "react";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ItemLineRow } from "~/ui/item-detail/ItemLineRow";
import {
	type ItemLineAvailabilityFilter,
	useItemLineSearch,
} from "~/ui/item-detail/useItemLineSearch";
import { Scrollable } from "~/ui/scrollable/Scrollable";

const availabilityOptions = [
	{
		label: "Available",
		value: "available",
	},
	{
		label: "All",
		value: "all",
	},
] as const satisfies readonly {
	readonly label: string;
	readonly value: ItemLineAvailabilityFilter;
}[];

const ItemLinesEmptyState = ({
	children,
	dataUi,
	icon,
}: {
	readonly children: ReactNode;
	readonly dataUi: string;
	readonly icon: string;
}) => (
	<div
		className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted"
		data-ui={dataUi}
	>
		<div className="grid max-w-sm justify-items-center gap-2">
			<span
				className={`${icon} size-6 text-subtle`}
				aria-hidden="true"
			/>
			{children}
		</div>
	</div>
);

/** Renders the authoritative visible product-line overview inside Item Detail. */
export const ItemLinesTab = ({
	disabled = false,
	initialQuery,
	lines,
}: {
	readonly disabled?: boolean;
	readonly initialQuery?: string;
	readonly lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => {
	const {
		availabilityFilter,
		availableLineCount,
		filteredLines,
		normalizedQuery,
		query,
		setAvailabilityFilter,
		setQuery,
	} = useItemLineSearch(lines, initialQuery);
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemLinesTab"
		>
			<div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row">
				<div
					className="min-w-0 flex-1"
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
				<fieldset className="shrink-0">
					<legend className="sr-only">Line availability</legend>
					<div
						className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface-raised/65 p-1"
						role="radiogroup"
						aria-label="Line availability"
						data-ui="ItemLinesAvailabilityFilter"
					>
						{availabilityOptions.map((option) => {
							const selected = availabilityFilter === option.value;
							const optionDisabled =
								option.value === "available" && availableLineCount === 0;
							return (
								<label
									key={option.value}
									className={`relative rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
										optionDisabled
											? "cursor-not-allowed text-muted opacity-50"
											: selected
												? "bg-accent text-accent-contrast hover:bg-accent-hover"
												: "cursor-pointer text-muted hover:bg-surface"
									}`}
									data-selected={selected ? "true" : "false"}
									data-disabled={optionDisabled ? "true" : "false"}
								>
									<input
										type="radio"
										name="item-lines-availability"
										value={option.value}
										checked={selected}
										disabled={optionDisabled}
										className="sr-only"
										onChange={() => setAvailabilityFilter(option.value)}
									/>
									{option.label}
								</label>
							);
						})}
					</div>
				</fieldset>
			</div>
			<Scrollable className="flex-1 pr-1">
				{lines.line.length === 0 && normalizedQuery === "" ? (
					<ItemLinesEmptyState
						dataUi="ItemLinesVisibleEmpty"
						icon="icon-[lucide--list-x]"
					>
						<p>No product line is currently visible.</p>
					</ItemLinesEmptyState>
				) : filteredLines.length === 0 ? (
					<ItemLinesEmptyState
						dataUi="ItemLinesSearchEmpty"
						icon="icon-[lucide--search-x]"
					>
						<p>No visible lines match “{normalizedQuery}”.</p>
					</ItemLinesEmptyState>
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
