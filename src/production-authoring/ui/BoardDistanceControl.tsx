import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";

const boardDistanceOptions = [
	{
		...BoardDistancePresentation.self,
		value: "self",
	},
	{
		...BoardDistancePresentation.close,
		value: "close",
	},
	{
		...BoardDistancePresentation.near,
		value: "near",
	},
	{
		...BoardDistancePresentation.far,
		value: "far",
	},
] as const;

export const BoardDistanceControl = ({
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (query: QuerySchema.Type) => void;
	readonly value: Extract<
		QuerySchema.Type,
		{
			readonly scope: "board";
		}
	>;
}) => (
	<EditorChoiceControl
		label="Board distance"
		value={value.distance}
		options={boardDistanceOptions}
		onChangeFn={(distance) =>
			onChangeFn({
				...value,
				distance,
			})
		}
	/>
);
