import type { ReactNode } from "react";

import { editorInputClassName } from "~/ui/form/EditorInputClassName";

const EditorValueField = ({
	children,
	description,
	label,
}: {
	readonly children: ReactNode;
	readonly description?: string;
	readonly label: string;
}) => (
	<label className="grid min-w-0 content-start gap-1.5 text-sm">
		<span className="font-semibold text-foreground">{label}</span>
		{children}
		{description === undefined ? null : (
			<span className="text-xs leading-5 text-subtle">{description}</span>
		)}
	</label>
);

export const EditorTextControl = ({
	label,
	onChange,
	placeholder,
	value,
}: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly value: string;
}) => (
	<EditorValueField label={label}>
		<input
			type="text"
			value={value}
			className={editorInputClassName}
			placeholder={placeholder}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	</EditorValueField>
);

export const EditorNumberControl = ({
	label,
	max,
	min,
	onChange,
	step = 1,
	value,
}: {
	readonly label: string;
	readonly max?: number;
	readonly min?: number;
	readonly onChange: (value: number) => void;
	readonly step?: number;
	readonly value: number;
}) => (
	<EditorValueField label={label}>
		<input
			type="number"
			value={Number.isNaN(value) ? "" : value}
			className={editorInputClassName}
			max={max}
			min={min}
			step={step}
			onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
		/>
	</EditorValueField>
);

export const EditorChoiceControl = <Value extends string>({
	label,
	onChange,
	options,
	value,
}: {
	readonly label: string;
	readonly onChange: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly label: string;
		readonly value: Value;
	}>;
	readonly value: Value;
}) => (
	<fieldset className="grid min-w-0 content-start gap-1.5 text-sm">
		<legend className="font-semibold text-foreground">{label}</legend>
		<div className="flex min-w-0 flex-wrap gap-2">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={option.value === value}
					className={`min-h-9 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
						option.value === value
							? "border-accent bg-accent text-accent-contrast"
							: "border-line bg-canvas/70 text-muted hover:border-line-strong hover:text-foreground"
					}`}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	</fieldset>
);
