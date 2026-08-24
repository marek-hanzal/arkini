import type { ReactNode } from "react";

import { EditorDurationHint } from "~/ui/form/EditorDurationHint";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { Tooltip } from "~/ui/overlay/Tooltip";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";

const EditorValueLabel = ({
	description,
	label,
}: {
	readonly description?: string;
	readonly label: string;
}) => (
	<span className="flex h-5 min-w-0 items-center gap-1 leading-5">
		<span className="font-semibold text-foreground">{label}</span>
		{description === undefined ? null : <EditorInfoTooltip content={description} />}
	</span>
);

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
		<EditorValueLabel
			description={description}
			label={label}
		/>
		{children}
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
	description,
	label,
	max,
	min,
	onChange,
	step = 1,
	value,
}: {
	readonly description?: string;
	readonly label: string;
	readonly max?: number;
	readonly min?: number;
	readonly onChange: (value: number) => void;
	readonly step?: number;
	readonly value: number;
}) => (
	<EditorValueField
		description={description}
		label={label}
	>
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

export const EditorSecondsControl = ({
	description,
	label,
	max,
	min,
	onChange,
	value,
}: {
	readonly description?: string;
	readonly label: string;
	readonly max?: number;
	readonly min?: number;
	readonly onChange: (value: number) => void;
	readonly value: number;
}) => (
	<EditorValueField
		description={description}
		label={label}
	>
		<input
			type="number"
			value={Number.isNaN(value) ? "" : value}
			className={editorInputClassName}
			max={max}
			min={min}
			step={0.001}
			onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
		/>
		<EditorDurationHint seconds={value} />
	</EditorValueField>
);

export const EditorChoiceControl = <Value extends string>({
	description,
	label,
	onChange,
	options,
	value,
}: {
	readonly description?: string;
	readonly label: string;
	readonly onChange: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly description?: ReactNode;
		readonly label: string;
		readonly value: Value;
	}>;
	readonly value: Value;
}) => (
	<div className="grid min-w-0 content-start gap-1.5 text-sm">
		<EditorValueLabel
			description={description}
			label={label}
		/>
		<div className="flex min-w-0 flex-wrap gap-2">
			{options.map((option) => {
				const button = (
					<button
						key={option.value}
						type="button"
						aria-pressed={option.value === value}
						className={`inline-flex min-h-[var(--ak-control-min-height)] cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
							option.value === value
								? selectableActiveClassName
								: selectableInactiveClassName
						}`}
						onClick={() => onChange(option.value)}
					>
						{option.label}
						{option.description === undefined ? null : (
							<span className="icon-[lucide--info] size-3.5 opacity-70" />
						)}
					</button>
				);
				return option.description === undefined ? (
					button
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
	</div>
);
