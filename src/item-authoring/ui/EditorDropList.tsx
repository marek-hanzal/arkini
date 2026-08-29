import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorDropControl } from "~/item-authoring/ui/EditorDropControl";
import { EditorItemDraftDefaults } from "~/item-authoring/ui/EditorItemDraftDefaults";
import { useEditorItemOptionLabel } from "~/item-authoring/ui/useEditorItemOptionLabel";

type EditorDropListValue = [
	DropSchema.Type,
	...DropSchema.Type[],
];

export const EditorDropList = ({
	onChange,
	value,
}: {
	readonly onChange: (drops: EditorDropListValue | undefined) => void;
	readonly value: EditorDropListValue;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description="Items emitted by the currently selected roll."
				title="Drops"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add drop"
				count={value.length}
				itemLabel={(index) => readItemLabel(value[index].itemId, `Drop ${index + 1}`)}
				label="Drops"
				onAdd={() =>
					onChange([
						...value,
						structuredClone(EditorItemDraftDefaults.drop),
					])
				}
				onRemove={(index) =>
					value.length === 1
						? onChange(undefined)
						: onChange(
								value.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as EditorDropListValue,
							)
				}
				removeLabel="Remove drop"
			>
				{(index) => (
					<EditorDropControl
						value={value[index]}
						onChange={(next) =>
							onChange(
								value.map((current, currentIndex) =>
									currentIndex === index ? next : current,
								) as EditorDropListValue,
							)
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
