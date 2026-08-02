import type { EditorQuery } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl } from "~/ui/form/EditorValueControls";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

const queryScopeOptions = [
	{
		label: "Board",
		value: "board",
	},
	{
		label: "Inventory",
		value: "inventory",
	},
	{
		label: "Toolbar",
		value: "toolbar",
	},
	{
		label: "Any local",
		value: "any",
	},
	{
		label: "Universe",
		value: "universe",
	},
] as const;

const boardDistanceOptions = [
	{
		label: "Self",
		value: "self",
	},
	{
		label: "Close",
		value: "close",
	},
	{
		label: "Near",
		value: "near",
	},
	{
		label: "Far",
		value: "far",
	},
] as const;

interface EditorQueryControlProps {
	readonly scopeLocked?: boolean;
	readonly onChange: (query: EditorQuery) => void;
	readonly value: EditorQuery;
}

const EditorBoardDistanceControl = ({
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
				<EditorChoiceControl
					label="Query scope"
					value={props.value.scope}
					options={queryScopeOptions}
					onChange={(scope) =>
						props.onChange(
							scope === "board"
								? {
										scope,
										distance: "close",
										selector: props.value.selector,
									}
								: {
										scope,
										selector: props.value.selector,
									},
						)
					}
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
