import { ItemInterfaceField } from "~/item-authoring/ui/ItemInterfaceField";
import {
	EditorChoiceControl,
	EditorNumberControl,
	EditorTextControl,
} from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

import { EditorMusicSelection } from "~/music-authoring/ui/EditorMusicSelection";
import { Mx } from "~/translation/ui/Mx";

export const IdentitySection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSectionDivider title={translator.textFn("Item details")} />
			<div className="grid grid-cols-2 items-stretch gap-4">
				<div className="grid content-start gap-4">
					<div className="grid min-w-0 items-start gap-3">
						<form.AppField name="title">
							{(field) => (
								<EditorTextControl
									autoComplete="off"
									label={translator.textFn("Title")}
									name={field.name}
									value={field.state.value}
									error={readEditorFieldErrorFn(field.state.meta.errors)}
									onBlurFn={field.handleBlur}
									onChangeFn={field.handleChange}
								/>
							)}
						</form.AppField>
					</div>
					<div className="flex items-start justify-between gap-4">
						<ItemInterfaceField />
					</div>
					<form.AppField name="units.amount">
						{(field) => (
							<EditorNumberControl
								label={translator.textFn("Units")}
								clearLabel={translator.textFn("Clear units")}
								description={<Mx label="Initial units help" />}
								name={field.name}
								value={field.state.value ?? Number.NaN}
								min={1}
								step={1}
								required={false}
								error={readEditorFieldErrorFn(field.state.meta.errors)}
								onBlurFn={field.handleBlur}
								onChangeFn={(amount) =>
									form.setFieldValue(
										"units",
										Number.isNaN(amount)
											? undefined
											: {
													amount,
												},
									)
								}
							/>
						)}
					</form.AppField>
					<form.AppField name="terminationMode">
						{(field) => (
							<EditorChoiceControl
								label={translator.textFn("Termination mode")}
								value={field.state.value ?? "loose-kill"}
								options={[
									{
										value: "loose-kill",
										label: translator.textFn("Loose-kill"),
										description: <Mx label="Termination loose-kill help" />,
									},
									{
										value: "kill-switch",
										label: translator.textFn("Kill switch"),
										description: <Mx label="Termination kill-switch help" />,
									},
								]}
								onChangeFn={field.handleChange}
							/>
						)}
					</form.AppField>
					<form.AppField name="music">
						{(field) => (
							<EditorMusicSelection
								resourceUid={field.state.value}
								onChangeFn={field.handleChange}
								error={readEditorFieldErrorFn(field.state.meta.errors)}
							/>
						)}
					</form.AppField>
					<form.AppField name="keywords">
						{(field) => (
							<field.TextAreaField
								label={translator.textFn("Keywords")}
								optional
								resizable={false}
								rows={2}
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
