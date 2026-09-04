import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";

interface SegmentedControlOption<Value extends string> {
	readonly description?: ReactNode;
	readonly disabled?: boolean;
	readonly label: ReactNode;
	readonly value: Value;
}

interface SegmentedControlProps<Value extends string> {
	readonly dataUi: string;
	readonly disabled?: boolean;
	readonly fill?: boolean;
	readonly invalid?: boolean;
	readonly onChangeFn: (value: Value) => void;
	readonly optionDataUi: string;
	readonly options: ReadonlyArray<SegmentedControlOption<Value>>;
	readonly pending?: boolean;
	readonly size?: "compact" | "default" | "large";
	readonly value: Value;
}

const SegmentedControlSizeClassName = {
	compact: "min-h-9 px-3 py-1.5 text-xs",
	default: "h-full min-h-0 px-3 py-0 text-sm",
	large: "h-full min-h-0 px-4 py-0 text-sm",
} as const;

const SegmentedControlFrameSizeClassName = {
	compact: "",
	default: "h-[var(--ak-control-min-height)] min-h-[var(--ak-control-min-height)]",
	large: "h-12 min-h-12",
} as const;

/** Renders one canonical mutually exclusive control with input-aligned framing. */
export const SegmentedControl = <Value extends string>({
	dataUi,
	disabled = false,
	fill = false,
	invalid = false,
	onChangeFn,
	optionDataUi,
	options,
	pending = false,
	size = "default",
	value,
}: SegmentedControlProps<Value>) => (
	<div
		className={`ak-segmented-control ${fill ? "flex w-full" : "inline-flex w-fit max-w-full self-start"} ${SegmentedControlFrameSizeClassName[size]} min-w-0 overflow-x-auto rounded-lg border border-line-strong bg-canvas/70 p-1 data-[ui-invalid=true]:border-danger`}
		{...readDataUiFn({
			dataUi,
			state: {
				fill,
				invalid,
			},
		})}
	>
		{options.map((option, optionIndex) => {
			const optionDisabled = disabled || pending || option.disabled === true;
			const disabledTooltipReference = optionDisabled && option.description !== undefined;
			const overlapClassName = optionIndex === 0 ? "" : "-ml-px";
			const edgeClassName = `${optionIndex === 0 ? "rounded-l-md" : ""} ${optionIndex === options.length - 1 ? "rounded-r-md" : ""}`;
			const button = (
				<button
					key={option.value}
					type="button"
					className={`ak-segmented-option relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none border font-semibold ${disabledTooltipReference ? "w-full pointer-events-none" : overlapClassName} ${edgeClassName} ${fill ? "flex-1" : ""} ${SegmentedControlSizeClassName[size]}`}
					disabled={optionDisabled}
					onClick={() => onChangeFn(option.value)}
					{...readDataUiFn({
						dataUi: optionDataUi,
						state: {
							disabled: optionDisabled,
							pending,
							selected: option.value === value,
							value: option.value,
						},
					})}
				>
					{option.label}
					{option.description === undefined ? null : (
						<Info className="size-3.5 opacity-70" />
					)}
				</button>
			);
			if (option.description === undefined) return button;
			return disabledTooltipReference ? (
				<Tooltip
					content={option.description}
					key={option.value}
				>
					<span
						className={`${overlapClassName} inline-flex shrink-0 cursor-not-allowed ${fill ? "flex-1" : ""}`}
					>
						{button}
					</span>
				</Tooltip>
			) : (
				<Tooltip
					content={option.description}
					key={option.value}
				>
					{button}
				</Tooltip>
			);
		})}
	</div>
);
