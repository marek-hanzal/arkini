import { Trash2 } from "lucide-react";
import { LinkButton } from "~/ui/ui/LinkButton";
import type { ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorDurationHint } from "~/editor-control/ui/EditorDurationHint";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

interface EditorValueControlProps {
	readonly description?: ReactNode;
	readonly error?: string;
	readonly label: string;
	readonly required?: boolean;
}

interface EditorNamedValueControlProps extends EditorValueControlProps {
	readonly name?: string;
	readonly onBlurFn?: () => void;
}

interface EditorNumericControlProps extends EditorNamedValueControlProps {
	readonly clearLabel?: string;
	readonly children?: ReactNode;
	readonly max?: number;
	readonly min?: number;
	readonly onChangeFn: (value: number) => void;
	readonly step: number;
	readonly value: number;
}

export const EditorValueLabel = ({
	description,
	label,
	required = false,
}: Pick<EditorValueControlProps, "description" | "label" | "required">) => (
	<span className="flex h-5 min-w-0 items-center gap-1 leading-5">
		<span className="font-semibold text-foreground">{label}</span>
		{required ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
		{description === undefined ? null : <EditorInfoTooltip content={description} />}
	</span>
);

const EditorValueField = ({
	children,
	description,
	error,
	fill = false,
	label,
	required = true,
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
			required={required}
		/>
		{children}
		{error === undefined ? null : (
			<span className="text-xs leading-5 text-danger">{error}</span>
		)}
	</label>
);

const EditorNumericControl = ({
	clearLabel,
	children,
	description,
	error,
	label,
	max,
	min,
	name,
	onBlurFn,
	onChangeFn,
	required,
	step,
	value,
}: EditorNumericControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		label={label}
		required={required}
	>
		<div className="flex min-w-0 items-center gap-3">
			<input
				type="number"
				name={name}
				value={Number.isNaN(value) ? "" : value}
				className={`${editorInputClassName} min-w-0 flex-1`}
				max={max}
				min={min}
				step={step}
				onBlur={onBlurFn}
				onChange={(event) => onChangeFn(event.currentTarget.valueAsNumber)}
				{...readDataUiFn({
					dataUi: "EditorNumericControlInput",
					state: {
						invalid: error !== undefined,
					},
				})}
			/>
			{clearLabel === undefined ? null : (
				<LinkButton
					title={clearLabel}
					disabled={Number.isNaN(value)}
					className="inline-flex h-[var(--ak-control-min-height)] shrink-0 items-center"
					onClick={(event) => {
						event.preventDefault();
						onChangeFn(Number.NaN);
					}}
				>
					<Trash2 className="size-4" />
				</LinkButton>
			)}
		</div>
		{children}
	</EditorValueField>
);

export const EditorTextControl = ({
	autoComplete,
	description,
	error,
	label,
	name,
	onBlurFn,
	onChangeFn,
	placeholder,
	readOnly,
	required,
	value,
}: {
	readonly autoComplete?: string;
	readonly onChangeFn: (value: string) => void;
	readonly placeholder?: string;
	readonly readOnly?: boolean;
	readonly value: string;
} & EditorNamedValueControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		label={label}
		required={required}
	>
		<input
			type="text"
			name={name}
			value={value}
			autoComplete={autoComplete}
			className={editorInputClassName}
			placeholder={placeholder}
			readOnly={readOnly}
			onBlur={onBlurFn}
			onChange={(event) => onChangeFn(event.currentTarget.value)}
			{...readDataUiFn({
				dataUi: "EditorTextControlInput",
				state: {
					invalid: error !== undefined,
				},
			})}
		/>
	</EditorValueField>
);

export const EditorTextAreaControl = ({
	description,
	error,
	fill = false,
	label,
	name,
	onBlurFn,
	onChangeFn,
	placeholder,
	required,
	rows = 4,
	value,
}: {
	readonly fill?: boolean;
	readonly onChangeFn: (value: string) => void;
	readonly placeholder?: string;
	readonly rows?: number;
	readonly value: string;
} & EditorNamedValueControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		fill={fill}
		label={label}
		required={required}
	>
		<textarea
			name={name}
			value={value}
			className={`${editorInputClassName} ${fill ? "h-full resize-none" : "resize-y"} leading-6`}
			placeholder={placeholder}
			rows={rows}
			onBlur={onBlurFn}
			onChange={(event) => onChangeFn(event.currentTarget.value)}
			{...readDataUiFn({
				dataUi: "EditorTextAreaControlInput",
				state: {
					invalid: error !== undefined,
				},
			})}
		/>
	</EditorValueField>
);

export const EditorNumberControl = ({
	step = 1,
	...props
}: {
	readonly max?: number;
	readonly min?: number;
	readonly onChangeFn: (value: number) => void;
	readonly step?: number;
	readonly value: number;
} & EditorNamedValueControlProps) => (
	<EditorNumericControl
		{...props}
		step={step}
	/>
);

export const EditorSecondsControl = ({
	step = 0.001,
	...props
}: {
	readonly clearLabel?: string;
	readonly max?: number;
	readonly min?: number;
	readonly step?: number;
	readonly onChangeFn: (value: number) => void;
	readonly value: number;
} & EditorNamedValueControlProps) => (
	<EditorNumericControl
		{...props}
		step={step}
	>
		<EditorDurationHint seconds={props.value} />
	</EditorNumericControl>
);

export const EditorChoiceControl = <Value extends string>({
	compact = false,
	description,
	error,
	label,
	onChangeFn,
	options,
	required = true,
	value,
}: {
	readonly compact?: boolean;
	readonly onChangeFn: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly description?: ReactNode;
		readonly disabled?: boolean;
		readonly label: string;
		readonly value: Value;
	}>;
	readonly value: Value;
} & EditorValueControlProps) => (
	<fieldset
		className="grid min-w-0 content-start gap-1.5 text-sm"
		{...readDataUiFn({
			dataUi: "EditorChoiceControl",
			state: {
				invalid: error !== undefined,
			},
		})}
	>
		<legend>
			<EditorValueLabel
				description={description}
				label={label}
				required={required}
			/>
		</legend>
		<SegmentedControl
			dataUi="EditorChoiceControlOptions"
			invalid={error !== undefined}
			onChangeFn={onChangeFn}
			optionDataUi="EditorChoiceControlOption"
			options={options}
			size={compact ? "compact" : "default"}
			value={value}
		/>
		{error === undefined ? null : (
			<span className="text-xs leading-5 text-danger">{error}</span>
		)}
	</fieldset>
);
