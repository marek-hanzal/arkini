import type { DropSchema } from "~/production-output/schema/DropSchema";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/item-authoring/ui/EditorItemReferenceControl";
import { EditorQuantityControl } from "~/item-authoring/ui/EditorQuantityControl";
import { EditorRulesControl } from "~/item-authoring/ui/EditorRulesControl";

export const EditorDropControl = ({
	onChange,
	value,
}: {
	readonly onChange: (drop: DropSchema.Type) => void;
	readonly value: DropSchema.Type;
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
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div className="min-w-0 basis-full sm:basis-1/2">
				<EditorQuantityControl
					value={value.quantity}
					onChange={(quantity) =>
						onChange({
							...value,
							quantity,
						})
					}
				/>
			</div>
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
			target="drop"
			description="These rules belong only to this item drop. Every condition inside a rule must pass. Enable rules gate this drop and any matching disable rule vetoes it when the roll resolves."
			allowedTypes={[
				"enable",
				"disable",
			]}
			onChange={(rules) =>
				onChange({
					...value,
					rules: rules as DropSchema.Type["rules"],
				})
			}
		/>
	</div>
);
