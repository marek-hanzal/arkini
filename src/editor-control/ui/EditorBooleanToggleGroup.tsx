import { ChevronDown, Info } from "lucide-react";
import { cloneElement, type ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";
import { ActionMenu, type ActionMenuOption } from "~/ui/ui/ActionMenu";

interface EditorBooleanToggleGroupOption {
	readonly icon?: ReactNode;
	readonly description: ReactNode;
	readonly label: string;
	readonly menuOptions?: readonly ActionMenuOption[];
	readonly onChangeFn: (selected: boolean) => void;
	readonly selected: boolean;
	readonly value: string;
}

/** Groups independent boolean buttons in the Editor's canonical segmented frame. */
export const EditorBooleanToggleGroup = ({
	options,
}: {
	readonly options: ReadonlyArray<EditorBooleanToggleGroupOption>;
}) => (
	<div
		className="ak-segmented-control inline-flex h-[var(--ak-control-min-height)] min-h-[var(--ak-control-min-height)] w-fit max-w-full min-w-0 self-start overflow-x-auto rounded-lg bg-canvas/70"
		data-ui="EditorBooleanToggleGroup"
	>
		{options.map((option, optionIndex) => {
			const overlapClassName = optionIndex === 0 ? "" : "-ml-px";
			const button = (
				<button
					key={option.value}
					type="button"
					className={`ak-segmented-option relative inline-flex h-full min-h-0 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none border px-3 py-0 text-sm font-semibold ${overlapClassName} ${optionIndex === 0 ? "rounded-l-md" : ""} ${optionIndex === options.length - 1 ? "rounded-r-md" : ""}`}
					onClick={
						option.menuOptions === undefined
							? () => option.onChangeFn(!option.selected)
							: undefined
					}
					{...readDataUiFn({
						dataUi: "EditorBooleanToggleGroupOption",
						state: {
							selected: option.selected,
							value: option.value,
						},
					})}
				>
					{option.icon}
					{option.label}
					{option.menuOptions === undefined ? (
						<Info className="size-3.5 opacity-70" />
					) : (
						<ChevronDown className="size-3.5 opacity-70" />
					)}
				</button>
			);
			return option.menuOptions === undefined ? (
				<Tooltip
					content={option.description}
					key={option.value}
				>
					{button}
				</Tooltip>
			) : (
				<ActionMenu
					key={option.value}
					options={option.menuOptions}
					renderTriggerFn={(props) => cloneElement(button, props)}
				/>
			);
		})}
	</div>
);
