import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/project-authoring/configuration/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/project-authoring/configuration/EditorProjectFormContext";

export const EditorProjectToolbarSection = () => {
	const { form } = useEditorProjectFormSession();
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
				<form.AppField name="toolbarSize">
					{(field) => (
						<field.NumberField
							label="Slots"
							min={0}
							max={64}
						/>
					)}
				</form.AppField>
			</EditorFormSection>
			<EditorFormSection
				description="Starting stacks placed in exact toolbar slots."
				title="Initial toolbar"
			>
				{size === 0 ? (
					<p className="text-sm text-muted">Toolbar is disabled.</p>
				) : (
					<EditorProjectStartGrid
						cells={cells}
						height={1}
						onCellsChange={(nextCells) =>
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
