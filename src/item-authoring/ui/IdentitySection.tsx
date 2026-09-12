import { Mx } from "~/translation/ui/Mx";
import { EditorChoiceControl, EditorValueLabel } from "~/editor-control/ui/EditorValueControls";
import { useStore } from "@tanstack/react-form";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useFormSession } from "~/item-authoring/ui/FormContext";

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
		<div className="grid grid-cols-2 items-stretch gap-4">
			<div className="grid auto-rows-fr gap-4">
				<form.AppField name="id">
					{(field) => (
						<field.TextField
							label={translator.textFn("Item ID")}
							description={translator.textFn(
								"Renaming updates exact project references.",
							)}
							placeholder="item:example"
						/>
					)}
				</form.AppField>
				<form.AppField name="title">
					{(field) => <field.TextField label={translator.textFn("Title")} />}
				</form.AppField>
				<div className="flex items-start justify-between gap-4">
					{clock !== undefined ? (
						<div className="grid content-start gap-1.5 text-sm">
							<EditorValueLabel
								label={translator.textFn("Storage scope")}
								description={<Mx label="Item storage scope help" />}
							/>
							<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-muted">
								{translator.textFn("Board — required by Clock")}
							</span>
						</div>
					) : (
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
					)}
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
					{clock !== undefined ? null : (
						<form.AppField name="maxStackSize">
							{(field) => (
								<field.NumberField
									label={translator.textFn("Maximum stack size")}
									description={<Mx label="Item stack size help" />}
									min={1}
								/>
							)}
						</form.AppField>
					)}
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
	);
};
