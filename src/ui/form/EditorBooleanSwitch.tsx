export interface EditorBooleanSwitchProps {
	readonly checked: boolean;
	readonly description?: string;
	readonly label: string;
	readonly onChange: (checked: boolean) => void;
}

/** Shared non-native boolean control used by every editor form layer. */
export const EditorBooleanSwitch = ({
	checked,
	description,
	label,
	onChange,
}: EditorBooleanSwitchProps) => (
	<div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-line bg-canvas/45 p-3">
		<div className="min-w-0">
			<p className="text-sm font-semibold text-foreground">{label}</p>
			{description === undefined ? null : (
				<p className="mt-1 text-xs leading-5 text-subtle">{description}</p>
			)}
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className={`relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors ${
				checked ? "border-accent bg-accent" : "border-line-strong bg-surface-raised"
			}`}
			onClick={() => onChange(!checked)}
		>
			<span
				className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${
					checked ? "translate-x-6" : "translate-x-1"
				}`}
			/>
		</button>
	</div>
);
