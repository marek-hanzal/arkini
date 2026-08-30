import { Info, type LucideIcon } from "lucide-react";

import { Tooltip } from "~/ui/overlay/Tooltip";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";

interface EditorBooleanToggleBadgeProps {
	readonly checked: boolean;
	readonly checkedIcon: LucideIcon;
	readonly description: string;
	readonly label: string;
	readonly onChange: (checked: boolean) => void;
	readonly uncheckedIcon: LucideIcon;
}

/** Shared state-labelled boolean badge used by every editor form layer. */
export const EditorBooleanToggleBadge = ({
	checked,
	checkedIcon,
	description,
	label,
	onChange,
	uncheckedIcon,
}: EditorBooleanToggleBadgeProps) => {
	const Icon = checked ? checkedIcon : uncheckedIcon;
	return (
		<div
			className={`inline-flex min-w-0 items-center rounded-full border ${
				checked ? selectableActiveClassName : selectableInactiveClassName
			}`}
			data-ui="EditorBooleanToggleBadge"
		>
			<button
				type="button"
				className="inline-flex min-h-9 cursor-pointer items-center gap-2 py-1.5 pl-3 pr-1 text-xs font-semibold text-inherit"
				onClick={() => onChange(!checked)}
			>
				<Icon className="size-4" />
				{label}
			</button>
			<Tooltip content={description}>
				<button
					type="button"
					data-ui="EditorInfoTooltip"
					className="grid size-8 min-h-0 min-w-0 shrink-0 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-current hover:text-current"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
				>
					<Info className="size-4" />
				</button>
			</Tooltip>
		</div>
	);
};
