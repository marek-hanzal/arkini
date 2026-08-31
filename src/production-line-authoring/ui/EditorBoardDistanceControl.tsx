import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";

const boardDistanceOptions = [
	{
		description: "Matches only the origin itself at board distance 0.",
		label: "Self",
		value: "self",
	},
	{
		description: "Matches items exactly 1 cell away, including diagonals.",
		label: "Close",
		value: "close",
	},
	{
		description: "Matches items exactly 2 cells away, including diagonals.",
		label: "Near",
		value: "near",
	},
	{
		description: "Matches any positive board distance and excludes only Self.",
		label: "Far",
		value: "far",
	},
] as const;

export const EditorBoardDistanceControl = ({
	onChange,
	value,
}: {
	readonly onChange: (query: QuerySchema.Type) => void;
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
		onChange={(distance) =>
			onChange({
				...value,
				distance,
			})
		}
	/>
);
