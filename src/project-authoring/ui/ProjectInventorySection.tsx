import { useStore } from "@tanstack/react-form";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectGridSizeValue } from "~/project-authoring/ui/ProjectGridSizeValue";
import { EditorProjectSizeMax } from "~/project-authoring/schema/ProjectFormSchema";

export const ProjectInventorySection = () => {
	const { form, validationIssues } = useProjectFormSession();
	const width = useStore(form.store, (state) => state.values.inventory.width);
	const height = useStore(form.store, (state) => state.values.inventory.height);
	const start = useStore(form.store, (state) => state.values.start);
	const startInventory = start.inventory;
	const cells = startInventory.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	const invalidCells = validationIssues.flatMap((issue) => {
		const [head, scope, index] = issue.path;
		if (head !== "start" || scope !== "inventory" || typeof index !== "number") return [];
		const entry = startInventory[index];
		return entry === undefined
			? []
			: [
					entry.position,
				];
	});
	return (
		<div className="grid gap-6">
			<EditorFormSection title="Inventory size">
				<EditorFormCard>
					<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
						<form.AppField name="inventory.width">
							{(field) => (
								<field.NumberField
									label="Width"
									max={EditorProjectSizeMax}
									min={1}
								/>
							)}
						</form.AppField>
						<form.AppField name="inventory.height">
							{(field) => (
								<field.NumberField
									label="Height"
									max={EditorProjectSizeMax}
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
			<EditorFormSection title="Initial inventory">
				<ProjectStartGrid
					cells={cells}
					height={height}
					invalidCells={invalidCells}
					mode="edit"
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
					start={start}
					width={width}
				/>
			</EditorFormSection>
		</div>
	);
};
