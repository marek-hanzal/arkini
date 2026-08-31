import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/project-authoring/ui/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/project-authoring/ui/EditorProjectFormContext";

export const EditorProjectInventorySection = () => {
	const { form } = useEditorProjectFormSession();
	const width = useStore(form.store, (state) => state.values.inventory.width);
	const height = useStore(form.store, (state) => state.values.inventory.height);
	const startInventory = useStore(form.store, (state) => state.values.start.inventory);
	const cells = startInventory.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	return (
		<div className="grid gap-6">
			<EditorFormSection
				description="The dimensions of the shared passive inventory grid."
				title="Inventory size"
			>
				<div className="grid gap-4 md:grid-cols-2">
					<form.AppField name="inventory.width">
						{(field) => (
							<field.NumberField
								label="Width"
								min={1}
							/>
						)}
					</form.AppField>
					<form.AppField name="inventory.height">
						{(field) => (
							<field.NumberField
								label="Height"
								min={1}
							/>
						)}
					</form.AppField>
				</div>
			</EditorFormSection>
			<EditorFormSection
				description="Starting stacks placed in exact inventory slots."
				title="Initial inventory"
			>
				<EditorProjectStartGrid
					cells={cells}
					height={height}
					onCellsChange={(nextCells) =>
						form.setFieldValue(
							"start.inventory",
							nextCells.map(({ x, y, ...cell }) => ({
								...cell,
								position: {
									x,
									y,
								},
							})),
						)
					}
					scope="inventory"
					width={width}
				/>
			</EditorFormSection>
		</div>
	);
};
