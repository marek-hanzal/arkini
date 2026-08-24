import type { EditorQuery } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

const queryScopeOptions = [
	{
		description:
			"Searches matching items on the current board at the selected distance from the line owner.",
		label: "Board",
		value: "board",
	},
	{
		description: "Searches matching items stored anywhere in the inventory.",
		label: "Inventory",
		value: "inventory",
	},
	{
		description: "Searches matching items stored anywhere in the toolbar.",
		label: "Toolbar",
		value: "toolbar",
	},
	{
		description:
			"Searches the inventory, toolbar, and the current board space without a board-distance limit.",
		label: "Any local",
		value: "any",
	},
	{
		description: "Searches the inventory, toolbar, and every board space in the current game.",
		label: "Universe",
		value: "universe",
	},
] as const;

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

interface EditorQueryControlProps {
	readonly scopeLocked?: boolean;
	readonly onChange: (query: EditorQuery) => void;
	readonly value: EditorQuery;
}

export const EditorBoardDistanceControl = ({
	onChange,
	value,
}: {
	readonly onChange: (query: EditorQuery) => void;
	readonly value: Extract<
		EditorQuery,
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

export const EditorQueryScopeControl = ({
	onChange,
	value,
}: {
	readonly onChange: (query: EditorQuery) => void;
	readonly value: EditorQuery;
}) => (
	<EditorChoiceControl
		label="Query scope"
		value={value.scope}
		options={queryScopeOptions}
		onChange={(scope) =>
			onChange(
				scope === "board"
					? {
							scope,
							distance: "close",
							selector: value.selector,
						}
					: {
							scope,
							selector: value.selector,
						},
			)
		}
	/>
);

/** Shared selector, scope and board-distance editor for every authored query. */
export const EditorQueryControl = (props: EditorQueryControlProps) => (
	<div className="grid gap-3">
		<EditorSelectorControl
			value={props.value.selector}
			onChange={(selector) =>
				props.onChange({
					...props.value,
					selector,
				})
			}
		/>
		<div className="grid gap-3 sm:grid-cols-2">
			{props.scopeLocked === true ? null : (
				<EditorQueryScopeControl
					value={props.value}
					onChange={props.onChange}
				/>
			)}
			{props.value.scope !== "board" ? null : (
				<EditorBoardDistanceControl
					value={props.value}
					onChange={props.onChange}
				/>
			)}
		</div>
	</div>
);
