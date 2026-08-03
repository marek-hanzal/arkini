import { createFormHook } from "@tanstack/react-form";
import type { PropsWithChildren } from "react";

import { EditorBooleanSwitch } from "~/ui/form/EditorBooleanSwitch";
import { fieldContext, formContext, useFieldContext } from "~/ui/form/EditorFormContexts";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { readEditorFieldError } from "~/ui/form/readEditorFieldError";
import { EditorItemAutocompleteField } from "~/ui/item/editor/EditorItemAutocompleteField";
import { EditorAssetAutocompleteField } from "~/ui/resource/editor/EditorAssetAutocompleteField";

const EditorField = ({
	children,
	description,
	error,
	label,
}: PropsWithChildren<{
	readonly description?: string;
	readonly error?: string;
	readonly label: string;
}>) => (
	<label className="grid min-w-0 content-start gap-1.5 text-sm">
		<span className="font-semibold text-foreground">{label}</span>
		{children}
		{description === undefined ? null : (
			<span className="text-xs leading-5 text-subtle">{description}</span>
		)}
		{error === undefined ? null : (
			<span className="text-xs leading-5 text-danger">{error}</span>
		)}
	</label>
);

export interface EditorTextFieldProps {
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
	const error = readEditorFieldError(field.state.meta.errors);
	return (
		<EditorField
			label={label}
			description={description}
			error={error}
		>
			<input
				type="text"
				name={field.name}
				value={field.state.value}
				autoComplete={autoComplete}
				aria-invalid={error === undefined ? undefined : true}
				className={editorInputClassName}
				placeholder={placeholder}
				readOnly={readOnly}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
			/>
		</EditorField>
	);
};

export interface EditorTextAreaFieldProps {
	readonly description?: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly rows?: number;
}

const EditorTextAreaField = ({
	description,
	label,
	placeholder,
	rows = 4,
}: EditorTextAreaFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldError(field.state.meta.errors);
	return (
		<EditorField
			label={label}
			description={description}
			error={error}
		>
			<textarea
				name={field.name}
				value={field.state.value}
				aria-invalid={error === undefined ? undefined : true}
				className={`${editorInputClassName} resize-y leading-6`}
				placeholder={placeholder}
				rows={rows}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
			/>
		</EditorField>
	);
};

export interface EditorNumberFieldProps {
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
	const error = readEditorFieldError(field.state.meta.errors);
	const value = field.state.value;
	return (
		<EditorField
			label={label}
			description={description}
			error={error}
		>
			<input
				type="number"
				name={field.name}
				value={typeof value === "number" && Number.isNaN(value) ? "" : (value ?? "")}
				aria-invalid={error === undefined ? undefined : true}
				className={editorInputClassName}
				max={max}
				min={min}
				step={step}
				onBlur={field.handleBlur}
				onChange={(event) => {
					const input = event.currentTarget;
					field.handleChange(
						input.value === "" && optional ? undefined : input.valueAsNumber,
					);
				}}
			/>
		</EditorField>
	);
};

export interface EditorChoiceFieldProps {
	readonly description?: string;
	readonly label: string;
	readonly options: ReadonlyArray<{
		readonly label: string;
		readonly value: string;
	}>;
}

const EditorChoiceField = ({ description, label, options }: EditorChoiceFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldError(field.state.meta.errors);
	return (
		<fieldset
			className="grid min-w-0 content-start gap-1.5 text-sm"
			aria-invalid={error === undefined ? undefined : true}
		>
			<legend className="font-semibold text-foreground">{label}</legend>
			<div className="flex min-w-0 flex-wrap gap-2">
				{options.map((option) => {
					const selected = field.state.value === option.value;
					return (
						<button
							key={option.value}
							type="button"
							className={`min-h-9 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
								selected
									? "border-accent bg-accent text-accent-contrast"
									: "border-line bg-canvas/70 text-muted hover:border-line-strong hover:text-foreground"
							}`}
							aria-pressed={selected}
							onClick={() => field.handleChange(option.value)}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			{description === undefined ? null : (
				<span className="text-xs leading-5 text-subtle">{description}</span>
			)}
			{error === undefined ? null : (
				<span className="text-xs leading-5 text-danger">{error}</span>
			)}
		</fieldset>
	);
};

export interface EditorBoolSwitchProps {
	readonly description?: string;
	readonly label: string;
}

const EditorBoolSwitch = ({ description, label }: EditorBoolSwitchProps) => {
	const field = useFieldContext<boolean>();
	return (
		<EditorBooleanSwitch
			checked={field.state.value}
			description={description}
			label={label}
			onChange={field.handleChange}
		/>
	);
};

export const { useAppForm, withFieldGroup } = createFormHook({
	fieldComponents: {
		AssetField: EditorAssetAutocompleteField,
		BoolSwitch: EditorBoolSwitch,
		ChoiceField: EditorChoiceField,
		ItemField: EditorItemAutocompleteField,
		NumberField: EditorNumberField,
		TextAreaField: EditorTextAreaField,
		TextField: EditorTextField,
	},
	formComponents: {},
	fieldContext,
	formContext,
});
