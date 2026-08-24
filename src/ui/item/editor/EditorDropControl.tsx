import type { EditorDrop } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

export const EditorDropControl = ({
	onChange,
	value,
}: {
	readonly onChange: (drop: EditorDrop) => void;
	readonly value: EditorDrop;
}) => (
	<div className="grid gap-3">
		<EditorItemReferenceControl
			label="Dropped item"
			value={value.itemId}
			onChange={(itemId) =>
				onChange({
					...value,
					itemId,
				})
			}
		/>
		<div className="grid items-end gap-3 sm:grid-cols-2">
			<EditorQuantityControl
				value={value.quantity}
				onChange={(quantity) =>
					onChange({
						...value,
						quantity,
					})
				}
			/>
			<EditorChoiceControl
				label="Board placement"
				value={value.placement}
				options={[
					{
						description:
							"Starts board placement at the production origin, then places stack-first into the nearest available cells.",
						label: "Local drop",
						value: "drop",
					},
					{
						description:
							"Chooses a random cell in the current board space as the placement origin, then places stack-first into the nearest available cells.",
						label: "Random",
						value: "random",
					},
				]}
				onChange={(placement) =>
					onChange({
						...value,
						placement,
					})
				}
			/>
		</div>
		<EditorRulesControl
			rules={value.rules}
			description="These rules belong only to this item drop. Every condition inside a rule must pass. Enable rules gate this drop and any matching disable rule vetoes it when the roll resolves."
			allowedTypes={[
				"enable",
				"disable",
			]}
			onChange={(rules) =>
				onChange({
					...value,
					rules: rules as EditorDrop["rules"],
				})
			}
		/>
	</div>
);
