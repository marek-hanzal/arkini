import { createFormHook } from "@tanstack/react-form";
import type { LucideIcon } from "lucide-react";

import { EditorBooleanToggleBadge } from "~/editor-control/ui/EditorBooleanToggleBadge";
import { fieldContext, formContext, useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import {
	EditorChoiceControl,
	EditorNumberControl,
	EditorSecondsControl,
	EditorTextAreaControl,
	EditorTextControl,
} from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { EditorItemAutocompleteField } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { AssetAutocompleteField } from "~/authoring-form/ui/AssetAutocompleteField";

interface EditorTextFieldProps {
	readonly autoComplete?: string;
	readonly description?: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly readOnly?: boolean;
}

const EditorTextField = ({
	autoComplete = "off",
	description,
	label,
	placeholder,
	readOnly = false,
}: EditorTextFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	return (
		<EditorTextControl
			autoComplete={autoComplete}
			description={description}
			error={error}
			label={label}
			name={field.name}
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
			placeholder={placeholder}
			readOnly={readOnly}
			value={field.state.value}
		/>
	);
};

interface EditorTextAreaFieldProps {
	readonly description?: string;
	readonly fill?: boolean;
	readonly label: string;
	readonly placeholder?: string;
	readonly rows?: number;
}

const EditorTextAreaField = ({
	description,
	fill = false,
	label,
	placeholder,
	rows = 4,
}: EditorTextAreaFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	return (
		<EditorTextAreaControl
			description={description}
			error={error}
			fill={fill}
			label={label}
			name={field.name}
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
			placeholder={placeholder}
			rows={rows}
			value={field.state.value}
		/>
	);
};

interface EditorNumberFieldProps {
	readonly description?: string;
	readonly label: string;
	readonly max?: number;
	readonly min?: number;
	readonly optional?: boolean;
	readonly step?: number;
}

const EditorNumberField = ({
	description,
	label,
	max,
	min,
	optional = false,
	step = 1,
}: EditorNumberFieldProps) => {
	const field = useFieldContext<number | undefined>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	const value = field.state.value;
	return (
		<EditorNumberControl
			description={description}
			error={error}
			label={label}
			max={max}
			min={min}
			name={field.name}
			onBlurFn={field.handleBlur}
			onChangeFn={(nextValue) =>
				field.handleChange(optional && Number.isNaN(nextValue) ? undefined : nextValue)
			}
			step={step}
			value={value ?? Number.NaN}
		/>
	);
};

interface EditorSecondsFieldProps {
	readonly description?: string;
	readonly label: string;
}

const EditorSecondsField = ({ description, label }: EditorSecondsFieldProps) => {
	const field = useFieldContext<number>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	const seconds = field.state.value / 1_000;
	return (
		<EditorSecondsControl
			description={description}
			error={error}
			label={label}
			min={0}
			name={field.name}
			onBlurFn={field.handleBlur}
			onChangeFn={(nextSeconds) => field.handleChange(Math.round(nextSeconds * 1_000))}
			value={seconds}
		/>
	);
};

interface EditorChoiceFieldProps {
	readonly description?: string;
	readonly label: string;
	readonly options: ReadonlyArray<{
		readonly label: string;
		readonly value: string;
	}>;
}

const EditorChoiceField = ({ description, label, options }: EditorChoiceFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	return (
		<EditorChoiceControl
			compact
			description={description}
			error={error}
			label={label}
			onChangeFn={field.handleChange}
			options={options}
			value={field.state.value}
		/>
	);
};

interface EditorBoolToggleProps {
	readonly checkedIcon: LucideIcon;
	readonly description: string;
	readonly label: string;
	readonly uncheckedIcon: LucideIcon;
}

const EditorBoolToggle = ({
	checkedIcon,
	description,
	label,
	uncheckedIcon,
}: EditorBoolToggleProps) => {
	const field = useFieldContext<boolean>();
	return (
		<EditorBooleanToggleBadge
			checked={field.state.value}
			checkedIcon={checkedIcon}
			description={description}
			label={label}
			onChangeFn={field.handleChange}
			uncheckedIcon={uncheckedIcon}
		/>
	);
};

// Keep the configured form API inferred by TanStack Form. If consumers are extracted
// later, use the library's withForm helper instead of mirroring its generic API by hand.
export const { useAppForm, withFieldGroup: withFieldGroupFn } = createFormHook({
	fieldComponents: {
		AssetField: AssetAutocompleteField,
		BoolToggle: EditorBoolToggle,
		ChoiceField: EditorChoiceField,
		ItemField: EditorItemAutocompleteField,
		NumberField: EditorNumberField,
		SecondsField: EditorSecondsField,
		TextAreaField: EditorTextAreaField,
		TextField: EditorTextField,
	},
	formComponents: {},
	fieldContext,
	formContext,
});
