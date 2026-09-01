import { useStore } from "@tanstack/react-form";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectGridSizeValue } from "~/project-authoring/ui/ProjectGridSizeValue";

export const ProjectInventorySection = () => {
	const { form } = useProjectFormSession();
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
				<EditorFormCard>
					<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
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
						<ProjectGridSizeValue
							height={height}
							width={width}
						/>
					</div>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				description="Starting stacks placed in exact inventory slots."
				title="Initial inventory"
			>
				<ProjectStartGrid
					cells={cells}
					height={height}
					onCellsChangeFn={(nextCells) =>
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
