import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectInventorySection = () => {
	const { form, project } = useEditorProjectFormSession();
	const width = useStore(form.store, (state) => state.values.inventory.width);
	const height = useStore(form.store, (state) => state.values.inventory.height);
	const startInventory = useStore(form.store, (state) => state.values.start.inventory);
	const cells = startInventory.map((entry) => ({
		itemId: entry.itemId,
		quantity: entry.quantity,
		x: entry.position.x,
		y: entry.position.y,
	}));
	const findIndex = (x: number, y: number) =>
		startInventory.findIndex((entry) => entry.position.x === x && entry.position.y === y);

	const moveStack = (sourceX: number, sourceY: number, targetX: number, targetY: number) => {
		if (sourceX === targetX && sourceY === targetY) return;
		const sourceIndex = findIndex(sourceX, sourceY);
		const source = startInventory[sourceIndex];
		if (source === undefined) return;
		form.setFieldValue(
			"start.inventory",
			startInventory.flatMap((entry, index) => {
				if (index === sourceIndex)
					return [
						{
							...entry,
							position: {
								x: targetX,
								y: targetY,
							},
						},
					];
				if (entry.position.x === targetX && entry.position.y === targetY) return [];
				return [
					entry,
				];
			}),
		);
	};
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
					scope="inventory"
					width={width}
					onMove={moveStack}
					onSet={(x, y, itemId) =>
						form.setFieldValue("start.inventory", [
							...startInventory,
							{
								itemId,
								position: {
									x,
									y,
								},
								quantity: 1,
							},
						])
					}
					onIncrement={(x, y) => {
						const index = findIndex(x, y);
						const current = startInventory[index];
						if (current === undefined) return;
						const maxStackSize =
							project.config.items[current.itemId]?.maxStackSize ?? 1;
						if (current.quantity >= maxStackSize) return;
						form.setFieldValue(
							"start.inventory",
							startInventory.map((entry, candidateIndex) =>
								candidateIndex === index
									? {
											...entry,
											quantity: entry.quantity + 1,
										}
									: entry,
							),
						);
					}}
					onDecrement={(x, y) => {
						const index = findIndex(x, y);
						const current = startInventory[index];
						if (current === undefined) return;
						form.setFieldValue(
							"start.inventory",
							current.quantity <= 1
								? startInventory.filter(
										(_, candidateIndex) => candidateIndex !== index,
									)
								: startInventory.map((entry, candidateIndex) =>
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
			</EditorFormSection>
		</div>
	);
};
