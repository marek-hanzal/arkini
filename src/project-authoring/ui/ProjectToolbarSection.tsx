import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useStore } from "@tanstack/react-form";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { EditorProjectSizeMax } from "~/project-authoring/schema/ProjectFormSchema";

export const ProjectToolbarSection = () => {
	const translator = useTranslator();
	const { form, validationIssues } = useProjectFormSession();
	const size = useStore(form.store, (state) => state.values.toolbarSize);
	const start = useStore(form.store, (state) => state.values.start);
	const startToolbar = start.toolbar;
	const cells = startToolbar.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	const invalidCells = validationIssues.flatMap((issue) => {
		const [head, scope, index] = issue.path;
		if (head !== "start" || scope !== "toolbar" || typeof index !== "number") return [];
		const entry = startToolbar[index];
		return entry === undefined
			? []
			: [
					entry.position,
				];
	});
	return (
		<div className="grid gap-6">
			<EditorFormCard>
				<form.AppField name="toolbarSize">
					{(field) => (
						<field.NumberField
							label={translator.textFn("Slots")}
							min={0}
							max={EditorProjectSizeMax}
						/>
					)}
				</form.AppField>
				<SectionEnd />
			</EditorFormCard>
			<EditorFormSection title={translator.textFn("Initial toolbar")}>
				{size === 0 ? (
					<div className="text-sm text-muted">
						<Mx label="Project toolbar disabled help" />
					</div>
				) : (
					<ProjectStartGrid
						cells={cells}
						height={1}
						invalidCells={invalidCells}
						mode="edit"
						onCellsChangeFn={(nextCells) =>
							form.setFieldValue(
								"start.toolbar",
								nextCells.map(({ x, y: _y, ...cell }) => ({
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
