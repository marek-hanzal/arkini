import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { EditorDurationHint } from "~/ui/form/EditorDurationHint";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { Tooltip } from "~/ui/overlay/Tooltip";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";

interface EditorValueControlProps {
	readonly description?: ReactNode;
	readonly error?: string;
	readonly label: string;
}

interface EditorNamedValueControlProps extends EditorValueControlProps {
	readonly name?: string;
	readonly onBlur?: () => void;
}

interface EditorNumericControlProps extends EditorNamedValueControlProps {
	readonly children?: ReactNode;
	readonly max?: number;
	readonly min?: number;
	readonly onChange: (value: number) => void;
	readonly step: number;
	readonly value: number;
}

export const EditorValueLabel = ({
	description,
	label,
}: Pick<EditorValueControlProps, "description" | "label">) => (
	<span className="flex h-5 min-w-0 items-center gap-1 leading-5">
		<span className="font-semibold text-foreground">{label}</span>
		{description === undefined ? null : <EditorInfoTooltip content={description} />}
	</span>
);

const EditorValueField = ({
	children,
	description,
	error,
	fill = false,
	label,
}: {
	readonly children: ReactNode;
	readonly fill?: boolean;
} & EditorValueControlProps) => (
	<label
		className={`grid min-w-0 gap-1.5 text-sm ${fill ? "h-full grid-rows-[auto_minmax(0,1fr)] content-stretch" : "content-start"}`}
	>
		<EditorValueLabel
			description={description}
			label={label}
		/>
		{children}
		{error === undefined ? null : (
			<span className="text-xs leading-5 text-danger">{error}</span>
		)}
	</label>
);

const EditorNumericControl = ({
	children,
	description,
	error,
	label,
	max,
	min,
	name,
	onBlur,
	onChange,
	step,
	value,
}: EditorNumericControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		label={label}
	>
		<input
			type="number"
			name={name}
			value={Number.isNaN(value) ? "" : value}
			aria-invalid={error === undefined ? undefined : true}
			className={editorInputClassName}
			max={max}
			min={min}
			step={step}
			onBlur={onBlur}
			onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
		/>
		{children}
	</EditorValueField>
);

export const EditorTextControl = ({
	autoComplete,
	description,
	error,
	label,
	name,
	onBlur,
	onChange,
	placeholder,
	readOnly,
	value,
}: {
	readonly autoComplete?: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly readOnly?: boolean;
	readonly value: string;
} & EditorNamedValueControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		label={label}
	>
		<input
			type="text"
			name={name}
			value={value}
			autoComplete={autoComplete}
			aria-invalid={error === undefined ? undefined : true}
			className={editorInputClassName}
			placeholder={placeholder}
			readOnly={readOnly}
			onBlur={onBlur}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	</EditorValueField>
);

export const EditorTextAreaControl = ({
	description,
	error,
	fill = false,
	label,
	name,
	onBlur,
	onChange,
	placeholder,
	rows = 4,
	value,
}: {
	readonly fill?: boolean;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly rows?: number;
	readonly value: string;
} & EditorNamedValueControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		fill={fill}
		label={label}
	>
		<textarea
			name={name}
			value={value}
			aria-invalid={error === undefined ? undefined : true}
			className={`${editorInputClassName} ${fill ? "h-full resize-none" : "resize-y"} leading-6`}
			placeholder={placeholder}
			rows={rows}
			onBlur={onBlur}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	</EditorValueField>
);

export const EditorNumberControl = ({
	step = 1,
	...props
}: {
	readonly max?: number;
	readonly min?: number;
	readonly onChange: (value: number) => void;
	readonly step?: number;
	readonly value: number;
} & EditorNamedValueControlProps) => (
	<EditorNumericControl
		{...props}
		step={step}
	/>
);

export const EditorSecondsControl = (
	props: {
		readonly max?: number;
		readonly min?: number;
		readonly onChange: (value: number) => void;
		readonly value: number;
	} & EditorNamedValueControlProps,
) => (
	<EditorNumericControl
		{...props}
		step={0.001}
	>
		<EditorDurationHint seconds={props.value} />
	</EditorNumericControl>
);

export const EditorChoiceControl = <Value extends string>({
	compact = false,
	description,
	error,
	label,
	onChange,
	options,
	value,
}: {
	readonly compact?: boolean;
	readonly onChange: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly description?: ReactNode;
		readonly label: string;
		readonly value: Value;
	}>;
	readonly value: Value;
} & EditorValueControlProps) => (
	<fieldset
		className="grid min-w-0 content-start gap-1.5 text-sm"
		aria-invalid={error === undefined ? undefined : true}
	>
		<legend>
			<EditorValueLabel
				description={description}
				label={label}
			/>
		</legend>
		<div className="flex min-w-0 flex-wrap gap-2">
			{options.map((option) => {
				const button = (
					<button
						key={option.value}
						type="button"
						aria-pressed={option.value === value}
						className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${compact ? "min-h-9" : "min-h-[var(--ak-control-min-height)]"} ${
							option.value === value
								? selectableActiveClassName
								: selectableInactiveClassName
						}`}
						onClick={() => onChange(option.value)}
					>
						{option.label}
						{option.description === undefined ? null : (
							<Info className="size-3.5 opacity-70" />
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
		{error === undefined ? null : (
			<span className="text-xs leading-5 text-danger">{error}</span>
		)}
	</fieldset>
);
