import { Tooltip } from "~/ui/overlay/Tooltip";

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
		<Tooltip content={description}>
			<button
				type="button"
				className="grid size-8 shrink-0 cursor-help place-items-center rounded-full text-muted hover:text-foreground"
			>
				<span className="icon-[lucide--info] size-4" />
			</button>
		</Tooltip>
	</div>
);
