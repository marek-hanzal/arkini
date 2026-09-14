import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorDurationHint } from "~/editor-control/ui/EditorDurationHint";
import { EditorValueField } from "~/editor-control/ui/EditorValueField";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";
import { EditorIconButton } from "~/editor-control/ui/EditorIconButton";

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
	readonly disabled?: boolean;
	readonly max?: number;
	readonly min?: number;
	readonly onChangeFn: (value: number) => void;
	readonly step: number;
	readonly value: number;
}

const EditorNumericControl = ({
	clearLabel,
	children,
	description,
	disabled = false,
	error,
	label,
	max,
	min,
	name,
	onBlurFn,
	onChangeFn,
	required = true,
	step,
	value,
}: EditorNumericControlProps) => (
	<EditorValueField
		description={description}
		error={error}
		label={label}
		required={required}
	>
		<div className="grid min-w-0 gap-1.5">
			<div className="flex min-w-0 items-center gap-3">
				<input
					type="number"
					disabled={disabled}
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
					<EditorIconButton
						title={clearLabel}
						disabled={disabled || Number.isNaN(value)}
						onClick={(event) => {
							event.preventDefault();
							onChangeFn(Number.NaN);
						}}
					>
						<Trash2 className="size-4" />
					</EditorIconButton>
				)}
			</div>
			{children}
		</div>
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
	required = true,
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
	required = true,
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
	readonly disabled?: boolean;
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
	readonly disabled?: boolean;
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
	<EditorValueField
		as="fieldset"
		dataUi="EditorChoiceControl"
		description={description}
		error={error}
		label={label}
		required={required}
	>
		<SegmentedControl
			dataUi="EditorChoiceControlOptions"
			invalid={error !== undefined}
			onChangeFn={onChangeFn}
			optionDataUi="EditorChoiceControlOption"
			options={options}
			size={compact ? "compact" : "default"}
			value={value}
		/>
	</EditorValueField>
);
