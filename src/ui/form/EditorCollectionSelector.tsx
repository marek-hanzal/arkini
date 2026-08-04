import { useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "~/ui/button/Button";
import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";

export interface EditorCollectionSelectorProps {
	readonly addLabel?: string;
	readonly children: (activeIndex: number, selectIndex: (index: number) => void) => ReactNode;
	readonly className?: string;
	readonly count: number;
	readonly dataUi?: string;
	readonly itemLabel: (index: number) => string;
	readonly label: string;
	readonly onAdd?: () => void;
	readonly onRemove?: (activeIndex: number) => void;
	readonly removeLabel?: string;
}

/** Keeps one form-owned collection item mounted behind a compact local selector. */
export const EditorCollectionSelector = ({
	addLabel = "Add item",
	children,
	className,
	count,
	dataUi = "EditorCollectionSelector",
	itemLabel,
	label,
	onAdd,
	onRemove,
	removeLabel = "Remove item",
}: EditorCollectionSelectorProps) => {
	const [requestedIndex, setRequestedIndex] = useState(0);
	const activeIndex = count === 0 ? undefined : Math.min(requestedIndex, count - 1);
	return (
		<section
			className={twMerge("grid min-w-0 gap-4", className)}
			data-ui={dataUi}
		>
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
						onChange={(index) => setRequestedIndex(Number(index))}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{onAdd === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 p-0"
							title={addLabel}
							onClick={() => {
								onAdd();
								setRequestedIndex(count);
							}}
						>
							<span className="icon-[lucide--plus] size-5" />
						</Button>
					)}
					{onRemove === undefined || activeIndex === undefined ? null : (
						<Button
							className="size-[var(--ak-control-min-height)] shrink-0 p-0"
							title={removeLabel}
							onClick={() => {
								onRemove(activeIndex);
								setRequestedIndex(Math.max(0, activeIndex - 1));
							}}
						>
							<span className="icon-[lucide--trash-2] size-4" />
						</Button>
					)}
				</div>
			</nav>
			{activeIndex === undefined ? null : (
				<div key={activeIndex}>{children(activeIndex, setRequestedIndex)}</div>
			)}
		</section>
	);
};
