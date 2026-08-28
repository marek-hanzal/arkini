import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";

export interface EditorBooleanToggleBadgeProps {
	readonly checked: boolean;
	readonly checkedIcon: string;
	readonly description: string;
	readonly label: string;
	readonly onChange: (checked: boolean) => void;
	readonly uncheckedIcon: string;
}

/** Shared state-labelled boolean badge used by every editor form layer. */
export const EditorBooleanToggleBadge = ({
	checked,
	checkedIcon,
	description,
	label,
	onChange,
	uncheckedIcon,
}: EditorBooleanToggleBadgeProps) => (
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
			<span className={`${checked ? checkedIcon : uncheckedIcon} size-4`} />
			{label}
		</button>
		<EditorInfoTooltip
			className="size-8 text-current hover:text-current"
			content={description}
		/>
	</div>
);
