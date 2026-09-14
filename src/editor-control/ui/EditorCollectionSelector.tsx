import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorIconButton } from "~/editor-control/ui/EditorIconButton";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";

interface EditorCollectionSelectorProps {
	readonly addLabel?: string;
	readonly children: (activeIndex: number) => ReactNode;
	readonly count: number;
	readonly dataUi?: string;
	readonly error?: string;
	readonly itemLabelFn: (index: number) => string;
	readonly itemMetaFn?: (index: number) => string | undefined;
	readonly itemRelatedSearchTermsFn?: (index: number) => ReadonlyArray<string>;
	readonly itemSearchTermsFn?: (index: number) => ReadonlyArray<string>;
	readonly initialSelectedIndex?: number;
	readonly label: string;
	readonly navigationCard?: boolean;
	readonly navigationHeader?: ReactNode;
	readonly onAddFn?: () => void;
	readonly onRemoveFn?: (activeIndex: number) => void;
	readonly removeDisabled?: boolean;
	readonly removeLabel?: string;
	readonly renderItemContentFn?: (index: number, label: string) => ReactNode;
	readonly renderItemPreviewFn?: (index: number) => ReactNode;
	readonly renderSelectedItemPreviewFn?: (index: number | undefined) => ReactNode;
	readonly selectedIndex?: number;
}

/** Shows exactly one selected collection item when the collection is nonempty. */
export const EditorCollectionSelector = ({
	addLabel = "Add item",
	children,
	count,
	dataUi = "EditorCollectionSelector",
	error,
	itemLabelFn,
	itemMetaFn,
	itemSearchTermsFn,
	itemRelatedSearchTermsFn,
	initialSelectedIndex = 0,
	label,
	navigationCard = false,
	navigationHeader,
	onAddFn,
	onRemoveFn,
	removeDisabled = false,
	removeLabel = "Remove item",
	renderItemContentFn,
	renderItemPreviewFn,
	renderSelectedItemPreviewFn,
	selectedIndex,
}: EditorCollectionSelectorProps) => {
	const [internalSelectedIndex, selectIndexFn] = useState(initialSelectedIndex);
	const requestedIndex = selectedIndex === undefined ? internalSelectedIndex : selectedIndex;
	const activeIndex = count === 0 ? undefined : Math.min(requestedIndex, count - 1);
	const navigation = (
		<>
			{navigationHeader}
			<nav className="flex min-w-0 items-start gap-2">
				<div className="min-w-0 flex-1">
					<EditorSearchCombobox
						disabled={activeIndex === undefined}
						displaySelectedLabel
						emptyLabel={`No ${label.toLocaleLowerCase()} match this search.`}
						error={error}
						label={label}
						labelVisible={false}
						optionContentLayout={itemMetaFn === undefined ? "stacked" : "inline"}
						options={Array.from(
							{
								length: count,
							},
							(_, index) => {
								const optionLabel = itemLabelFn(index);
								const optionMeta = itemMetaFn?.(index);
								return {
									id: String(index),
									relatedTerms: itemRelatedSearchTermsFn?.(index),
									label: optionLabel,
									...(optionMeta === undefined
										? {}
										: {
												meta: optionMeta,
											}),
									terms: [
										optionLabel,
										...(optionMeta === undefined
											? []
											: [
													optionMeta,
												]),
										...(itemSearchTermsFn?.(index) ?? []),
									],
								};
							},
						)}
						renderOptionContentFn={
							renderItemContentFn === undefined
								? undefined
								: (option) => renderItemContentFn(Number(option.id), option.label)
						}
						renderPreviewFn={(option) =>
							renderItemPreviewFn?.(Number(option.id)) ?? null
						}
						renderSelectedPreviewFn={
							renderSelectedItemPreviewFn === undefined
								? undefined
								: (option) =>
										renderSelectedItemPreviewFn(
											option === undefined ? undefined : Number(option.id),
										)
						}
						value={activeIndex === undefined ? "" : String(activeIndex)}
						onChangeFn={(index) => selectIndexFn(Number(index))}
					/>
				</div>
				<div className="flex shrink-0 items-center">
					{onAddFn === undefined ? null : (
						<EditorIconButton
							title={addLabel}
							onClick={() => {
								onAddFn();
								selectIndexFn(count);
							}}
						>
							<Plus className="size-5" />
						</EditorIconButton>
					)}
					{onRemoveFn === undefined ? null : (
						<EditorIconButton
							disabled={removeDisabled || activeIndex === undefined}
							title={removeLabel}
							onClick={() => {
								if (removeDisabled || activeIndex === undefined) return;
								onRemoveFn(activeIndex);
								selectIndexFn(Math.max(0, activeIndex - 1));
							}}
						>
							<Trash2 className="size-4" />
						</EditorIconButton>
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
				<div key={activeIndex}>{children(activeIndex)}</div>
			)}
		</section>
	);
};
