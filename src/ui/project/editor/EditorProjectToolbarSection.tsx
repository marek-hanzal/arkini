import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectToolbarSection = () => {
	const { form, project } = useEditorProjectFormSession();
	const size = useStore(form.store, (state) => state.values.toolbarSize);
	const startToolbar = useStore(form.store, (state) => state.values.start.toolbar);
	const cells = startToolbar.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	const findIndex = (x: number) =>
		startToolbar.findIndex((entry) => entry.position.x === x && entry.position.y === 0);
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
						scope="toolbar"
						width={size}
						onSet={(x, _y, itemId) =>
							form.setFieldValue("start.toolbar", [
								...startToolbar,
								{
									itemId,
									position: {
										x,
										y: 0,
									},
									quantity: 1,
								},
							])
						}
						onIncrement={(x) => {
							const index = findIndex(x);
							const current = startToolbar[index];
							if (current === undefined) return;
							const maxStackSize =
								project.config.items[current.itemId]?.maxStackSize ?? 1;
							if (current.quantity >= maxStackSize) return;
							form.setFieldValue(
								"start.toolbar",
								startToolbar.map((entry, candidateIndex) =>
									candidateIndex === index
										? {
												...entry,
												quantity: entry.quantity + 1,
											}
										: entry,
								),
							);
						}}
						onDecrement={(x) => {
							const index = findIndex(x);
							const current = startToolbar[index];
							if (current === undefined) return;
							form.setFieldValue(
								"start.toolbar",
								current.quantity <= 1
									? startToolbar.filter(
											(_, candidateIndex) => candidateIndex !== index,
										)
									: startToolbar.map((entry, candidateIndex) =>
											candidateIndex === index
												? {
														...entry,
														quantity: entry.quantity - 1,
													}
												: entry,
										),
							);
						}}
					/>
				)}
			</EditorFormSection>
		</div>
	);
};
