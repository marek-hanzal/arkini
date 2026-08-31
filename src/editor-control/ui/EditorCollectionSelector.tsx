import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "~/ui/ui/Button";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";

interface EditorCollectionSelectorProps {
	readonly addLabel?: string;
	readonly children: (activeIndex: number, selectIndexFn: (index: number) => void) => ReactNode;
	readonly count: number;
	readonly dataUi?: string;
	readonly itemLabelFn: (index: number) => string;
	readonly initialSelectedIndex?: number;
	readonly label: string;
	readonly navigationCard?: boolean;
	readonly navigationHeader?: ReactNode;
	readonly onAddFn?: () => void;
	readonly onRemoveFn?: (activeIndex: number) => void;
	readonly onSelectedIndexChangeFn?: (index: number) => void;
	readonly removeLabel?: string;
	readonly selectedIndex?: number;
}

/** Keeps one form-owned collection item mounted behind a compact local selector. */
export const EditorCollectionSelector = ({
	addLabel = "Add item",
	children,
	count,
	dataUi = "EditorCollectionSelector",
	itemLabelFn,
	initialSelectedIndex = 0,
	label,
	navigationCard = false,
	navigationHeader,
	onAddFn,
	onRemoveFn,
	onSelectedIndexChangeFn,
	removeLabel = "Remove item",
	selectedIndex,
}: EditorCollectionSelectorProps) => {
	const [internalSelectedIndex, setInternalSelectedIndexFn] = useState(initialSelectedIndex);
	const requestedIndex = selectedIndex ?? internalSelectedIndex;
	const selectIndexFn = (index: number) => {
		setInternalSelectedIndexFn(index);
		onSelectedIndexChangeFn?.(index);
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
								const optionLabel = itemLabelFn(index);
								return {
									id: String(index),
									label: optionLabel,
									terms: [
										optionLabel,
									],
								};
							},
						)}
						renderPreviewFn={() => null}
						value={activeIndex === undefined ? "" : String(activeIndex)}
						onChangeFn={(index) => selectIndexFn(Number(index))}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{onAddFn === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
							title={addLabel}
							onClick={() => {
								onAddFn();
								selectIndexFn(count);
							}}
						>
							<Plus className="size-5" />
						</Button>
					)}
					{onRemoveFn === undefined || activeIndex === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
							title={removeLabel}
							onClick={() => {
								onRemoveFn(activeIndex);
								selectIndexFn(Math.max(0, activeIndex - 1));
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
				<div key={activeIndex}>{children(activeIndex, selectIndexFn)}</div>
			)}
		</section>
	);
};
