import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";

interface EditorBooleanToggleGroupOption {
	readonly description: ReactNode;
	readonly label: string;
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
			return (
				<Tooltip
					content={option.description}
					key={option.value}
				>
					<button
						type="button"
						className={`ak-segmented-option relative inline-flex h-full min-h-0 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none border px-3 py-0 text-sm font-semibold ${overlapClassName} ${optionIndex === 0 ? "rounded-l-md" : ""} ${optionIndex === options.length - 1 ? "rounded-r-md" : ""}`}
						onClick={() => option.onChangeFn(!option.selected)}
						{...readDataUiFn({
							dataUi: "EditorBooleanToggleGroupOption",
							state: {
								selected: option.selected,
								value: option.value,
							},
						})}
					>
						{option.label}
						<Info className="size-3.5 opacity-70" />
					</button>
				</Tooltip>
			);
		})}
	</div>
);
