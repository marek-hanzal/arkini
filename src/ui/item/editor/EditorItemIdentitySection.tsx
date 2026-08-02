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
	const { canonicalItem, categoryOptions, form, isNew } = useEditorItemFormSession();
	return (
		<div className="grid gap-4">
			<div className="grid gap-4 md:grid-cols-2">
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
						<span className="font-semibold text-foreground">Item ID</span>
						<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 font-mono text-muted">
							{canonicalItem.id}
						</span>
						<span className="text-xs text-muted">
							Immutable after the item is first saved.
						</span>
					</div>
				)}
				<form.AppField name="title">
					{(field) => <field.TextField label="Title" />}
				</form.AppField>
			</div>
			<form.AppField name="description">
				{(field) => <field.TextAreaField label="Description" />}
			</form.AppField>
			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField name="categoryId">
					{(field) =>
						categoryOptions.length === 0 ? (
							<field.TextField label="Category ID" />
						) : (
							<field.ChoiceField
								label="Category"
								options={categoryOptions}
							/>
						)
					}
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
			</div>
			<form.AppField name="tags">
				{(field) => (
					<field.TagsField
						label="Tags"
						description="Comma-separated semantic tags used by selectors and search."
					/>
				)}
			</form.AppField>
		</div>
	);
};
