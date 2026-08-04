import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";

export interface EditorBooleanToggleBadgeProps {
	readonly checked: boolean;
	readonly checkedIcon: string;
	readonly checkedLabel: string;
	readonly description: string;
	readonly onChange: (checked: boolean) => void;
	readonly uncheckedIcon: string;
	readonly uncheckedLabel: string;
}

/** Shared state-labelled boolean badge used by every editor form layer. */
export const EditorBooleanToggleBadge = ({
	checked,
	checkedIcon,
	checkedLabel,
	description,
	onChange,
	uncheckedIcon,
	uncheckedLabel,
}: EditorBooleanToggleBadgeProps) => (
	<div className="flex min-w-0 items-center gap-2">
		<button
			type="button"
			className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
				checked
					? "border-accent bg-accent text-accent-contrast"
					: "border-line-strong bg-surface-raised text-muted"
			}`}
			onClick={() => onChange(!checked)}
		>
			<span className={`${checked ? checkedIcon : uncheckedIcon} size-4`} />
			{checked ? checkedLabel : uncheckedLabel}
		</button>
		<EditorInfoTooltip content={description} />
	</div>
);
