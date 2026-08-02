import { useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "~/ui/button/Button";

export interface EditorCollectionTabsProps {
	readonly addLabel?: string;
	readonly children: (activeIndex: number, selectIndex: (index: number) => void) => ReactNode;
	readonly className?: string;
	readonly count: number;
	readonly dataUi?: string;
	readonly itemLabel: (index: number) => ReactNode;
	readonly label: string;
	readonly onAdd?: () => void;
	readonly onRemove?: (activeIndex: number) => void;
	readonly removeLabel?: string;
}

/** Projects one form-owned collection into locally selected, horizontally scrollable editor tabs. */
export const EditorCollectionTabs = ({
	addLabel = "Add item",
	children,
	className,
	count,
	dataUi = "EditorCollectionTabs",
	itemLabel,
	label,
	onAdd,
	onRemove,
	removeLabel = "Remove item",
}: EditorCollectionTabsProps) => {
	const [requestedIndex, setRequestedIndex] = useState(0);
	const activeIndex = count === 0 ? undefined : Math.min(requestedIndex, count - 1);
	return (
		<section
			className={twMerge("grid min-w-0 gap-4", className)}
			data-ui={dataUi}
		>
			<nav
				className="min-w-0 overflow-x-auto overscroll-x-contain border-b border-line"
				aria-label={label}
			>
				<div className="flex min-w-max items-end gap-1">
					{Array.from(
						{
							length: count,
						},
						(_, index) => (
							<Button
								key={index}
								className={twMerge(
									"min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 text-sm shadow-none",
									index === activeIndex &&
										"border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
								)}
								onClick={() => setRequestedIndex(index)}
							>
								{itemLabel(index)}
							</Button>
						),
					)}
					{onAdd === undefined ? null : (
						<Button
							className="min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 shadow-none"
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
							className="min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 shadow-none"
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
