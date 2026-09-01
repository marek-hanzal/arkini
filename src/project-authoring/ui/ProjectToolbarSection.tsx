import { useStore } from "@tanstack/react-form";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

export const ProjectToolbarSection = () => {
	const { form } = useProjectFormSession();
	const size = useStore(form.store, (state) => state.values.toolbarSize);
	const startToolbar = useStore(form.store, (state) => state.values.start.toolbar);
	const cells = startToolbar.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	return (
		<div className="grid gap-6">
			<EditorFormSection
				description="The one-row passive toolbar. Set its size to zero to disable it."
				title="Toolbar size"
			>
				<EditorFormCard>
					<form.AppField name="toolbarSize">
						{(field) => (
							<field.NumberField
								label="Slots"
								min={0}
								max={64}
							/>
						)}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				description="Starting stacks placed in exact toolbar slots."
				title="Initial toolbar"
			>
				{size === 0 ? (
					<p className="text-sm text-muted">Toolbar is disabled.</p>
				) : (
					<ProjectStartGrid
						cells={cells}
						height={1}
						mode="edit"
						onCellsChangeFn={(nextCells) =>
							form.setFieldValue(
								"start.toolbar",
								nextCells.map(({ x, ...cell }) => ({
									...cell,
									position: {
										x,
										y: 0,
									},
								})),
							)
						}
						scope="toolbar"
						width={size}
					/>
				)}
			</EditorFormSection>
		</div>
	);
};
