import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";

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

export const EditorItemIdentitySection = () => {
	const { canonicalItem, form, isNew } = useEditorItemFormSession();
	return (
		<div className="grid grid-cols-2 items-stretch gap-4">
			<div className="grid auto-rows-fr gap-4">
				{isNew ? (
					<form.AppField name="id">
						{(field) => (
							<field.TextField
								label="Item ID"
								description="The source ID becomes immutable after the first save."
								placeholder="item:example"
							/>
						)}
					</form.AppField>
				) : (
					<div className="grid content-start gap-1.5 text-sm">
						<span className="flex min-w-0 items-center gap-1">
							<span className="font-semibold text-foreground">Item ID</span>
							<EditorInfoTooltip content="Immutable after the item is first saved." />
						</span>
						<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 font-mono text-muted">
							{canonicalItem.id}
						</span>
					</div>
				)}
				<form.AppField name="title">
					{(field) => <field.TextField label="Title" />}
				</form.AppField>
				{canonicalItem.type === "inventory" || canonicalItem.type === "temporary" ? (
					<div className="grid content-start gap-1.5 text-sm">
						<span className="font-semibold text-foreground">Storage scope</span>
						<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-muted">
							Board — fixed by {canonicalItem.type} contract
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
				{canonicalItem.type === "inventory" ? null : (
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
				)}
				{canonicalItem.type === "inventory" || canonicalItem.type === "temporary" ? null : (
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
					/>
				)}
			</form.AppField>
		</div>
	);
};
