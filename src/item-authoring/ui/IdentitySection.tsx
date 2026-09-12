import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
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
							label="Item ID"
							description="Renaming updates exact project references."
							placeholder="item:example"
						/>
					)}
				</form.AppField>
				<form.AppField name="title">
					{(field) => <field.TextField label="Title" />}
				</form.AppField>
				{clock !== undefined ? (
					<div className="grid content-start gap-1.5 text-sm">
						<span className="font-semibold text-foreground">Storage scope</span>
						<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-muted">
							{translator.textFn("Board — required by this item’s lifetime")}
						</span>
					</div>
				) : (
					<form.AppField name="scope">
						{(field) => (
							<field.ChoiceField
								label="Storage scope"
								options={scopeOptions}
							/>
						)}
					</form.AppField>
				)}
				{
					<form.AppField name="control">
						{(field) => (
							<EditorChoiceControl
								value={field.state.value ?? "interactive"}
								onChangeFn={field.handleChange}
								label={translator.textFn("Player controls")}
								description={translator.textFn(
									"Interactive allows manual production. Automatic only uses authored automation.",
								)}
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
				}
				{
					<form.AppField name="maxCount">
						{(field) => (
							<field.NumberField
								label="Maximum global count"
								description="Leave empty for no global limit."
								min={1}
								optional
							/>
						)}
					</form.AppField>
				}
				{clock !== undefined ? null : (
					<form.AppField name="maxStackSize">
						{(field) => (
							<field.NumberField
								label="Maximum stack size"
								min={1}
							/>
						)}
					</form.AppField>
				)}
			</div>
			<form.AppField name="description">
				{(field) => (
					<field.TextAreaField
						fill
						label="Description"
						optional
					/>
				)}
			</form.AppField>
		</div>
	);
};
