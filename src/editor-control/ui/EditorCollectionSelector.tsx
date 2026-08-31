import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "~/ui/ui/Button";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";

interface EditorCollectionSelectorProps {
	readonly addLabel?: string;
	readonly children: (activeIndex: number, selectIndex: (index: number) => void) => ReactNode;
	readonly count: number;
	readonly dataUi?: string;
	readonly itemLabel: (index: number) => string;
	readonly initialSelectedIndex?: number;
	readonly label: string;
	readonly navigationCard?: boolean;
	readonly navigationHeader?: ReactNode;
	readonly onAdd?: () => void;
	readonly onRemove?: (activeIndex: number) => void;
	readonly onSelectedIndexChange?: (index: number) => void;
	readonly removeLabel?: string;
	readonly selectedIndex?: number;
}

/** Keeps one form-owned collection item mounted behind a compact local selector. */
export const EditorCollectionSelector = ({
	addLabel = "Add item",
	children,
	count,
	dataUi = "EditorCollectionSelector",
	itemLabel,
	initialSelectedIndex = 0,
	label,
	navigationCard = false,
	navigationHeader,
	onAdd,
	onRemove,
	onSelectedIndexChange,
	removeLabel = "Remove item",
	selectedIndex,
}: EditorCollectionSelectorProps) => {
	const [internalSelectedIndex, setInternalSelectedIndex] = useState(initialSelectedIndex);
	const requestedIndex = selectedIndex ?? internalSelectedIndex;
	const selectIndex = (index: number) => {
		setInternalSelectedIndex(index);
		onSelectedIndexChange?.(index);
	};
	const activeIndex = count === 0 ? undefined : Math.min(requestedIndex, count - 1);
	const navigation = (
		<>
			{navigationHeader}
			<nav className="flex min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					<EditorSearchCombobox
						displaySelectedLabel
						emptyLabel={`No ${label.toLocaleLowerCase()} match this search.`}
						label={label}
						labelVisible={false}
						options={Array.from(
							{
								length: count,
							},
							(_, index) => {
								const optionLabel = itemLabel(index);
								return {
									id: String(index),
									label: optionLabel,
									terms: [
										optionLabel,
									],
								};
							},
						)}
						renderPreview={() => null}
						value={activeIndex === undefined ? "" : String(activeIndex)}
						onChange={(index) => selectIndex(Number(index))}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{onAdd === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
							title={addLabel}
							onClick={() => {
								onAdd();
								selectIndex(count);
							}}
						>
							<Plus className="size-5" />
						</Button>
					)}
					{onRemove === undefined || activeIndex === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
							title={removeLabel}
							onClick={() => {
								onRemove(activeIndex);
								selectIndex(Math.max(0, activeIndex - 1));
							}}
						>
							<Trash2 className="size-4" />
						</Button>
					)}
				</div>
			</nav>
		</>
	);
	return (
		<section
			className="grid min-w-0 gap-4"
			data-ui={dataUi}
		>
			{navigationCard ? <EditorFormCard>{navigation}</EditorFormCard> : navigation}
			{activeIndex === undefined ? null : (
				<div key={activeIndex}>{children(activeIndex, selectIndex)}</div>
			)}
		</section>
	);
};
