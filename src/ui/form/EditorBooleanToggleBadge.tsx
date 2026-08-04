import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";

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
	<div className="flex min-w-0 items-center gap-2">
		<button
			type="button"
			className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
				checked
					? "border-success/45 bg-secondary text-secondary-foreground"
					: "border-line-strong bg-surface-raised text-muted"
			}`}
			onClick={() => onChange(!checked)}
		>
			<span className={`${checked ? checkedIcon : uncheckedIcon} size-4`} />
			{label}
		</button>
		<EditorInfoTooltip content={description} />
	</div>
);
