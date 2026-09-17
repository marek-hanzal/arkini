import { Mx } from "~/translation/ui/Mx";
import { EditorChoiceControl, EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { readEditorIdFromTitleFn } from "~/editor-control/fn/readEditorIdFromTitleFn";
import { useStore } from "@tanstack/react-form";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

import { EditorMusicSelection } from "~/music-authoring/ui/EditorMusicSelection";

const scopeOptions = [
	{
		label: "Any",
		value: "any",
	},
	{
		label: "Board",
		value: "board",
	},
	{
		label: "Inventory",
		value: "inventory",
	},
	{
		label: "Toolbar",
		value: "toolbar",
	},
] as const;

export const IdentitySection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	const clock = useStore(form.store, (state) => state.values.clock);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSectionDivider title={translator.textFn("Item details")} />
			<div className="grid grid-cols-2 items-stretch gap-4">
				<div className="grid content-start gap-4">
					<div className="grid min-w-0 grid-cols-2 items-start gap-3">
						<form.AppField name="title">
							{(field) => (
								<EditorTextControl
									autoComplete="off"
									label={translator.textFn("Title")}
									name={field.name}
									value={field.state.value}
									error={readEditorFieldErrorFn(field.state.meta.errors)}
									onBlurFn={field.handleBlur}
									onChangeFn={(title) => {
										field.handleChange(title);
										form.setFieldValue("id", readEditorIdFromTitleFn(title));
									}}
								/>
							)}
						</form.AppField>
						<form.AppField name="id">
							{(field) => (
								<field.TextField
									label={translator.textFn("Item ID")}
									description={<Mx label="Item ID help" />}
									placeholder="item:example"
								/>
							)}
						</form.AppField>
					</div>
					<div className="flex items-start justify-between gap-4">
						<form.AppField name="scope">
							{(field) => (
								<field.ChoiceField
									label={translator.textFn("Storage scope")}
									description={<Mx label="Item storage scope help" />}
									options={scopeOptions.map((option) => ({
										...option,
										label: translator.textFn(option.label),
									}))}
								/>
							)}
						</form.AppField>
						<form.AppField name="control">
							{(field) => (
								<EditorChoiceControl
									value={field.state.value ?? "interactive"}
									onChangeFn={field.handleChange}
									label={translator.textFn("Player controls")}
									description={<Mx label="Item player controls help" />}
									options={[
										{
											label: translator.textFn("Interactive"),
											value: "interactive",
										},
										{
											label: translator.textFn("Automatic only"),
											value: "automatic-only",
										},
									]}
								/>
							)}
						</form.AppField>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<form.AppField name="maxStackSize">
							{(field) => (
								<field.NumberField
									disabled={clock !== undefined}
									label={translator.textFn("Maximum stack size")}
									description={<Mx label="Item stack size help" />}
									min={1}
								/>
							)}
						</form.AppField>
						<form.AppField name="maxCount">
							{(field) => (
								<field.NumberField
									label={translator.textFn("Maximum global count")}
									description={<Mx label="Item global count help" />}
									min={1}
									optional
								/>
							)}
						</form.AppField>
					</div>
					<form.AppField name="music">
						{(field) => (
							<EditorMusicSelection
								resourceId={field.state.value}
								onChangeFn={field.handleChange}
								error={readEditorFieldErrorFn(field.state.meta.errors)}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="description">
					{(field) => (
						<field.TextAreaField
							fill
							label={translator.textFn("Description")}
							optional
						/>
					)}
				</form.AppField>
			</div>
		</div>
	);
};
