import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { QueryScopePresentation } from "~/item-query/ui/QueryPresentation";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

const queryScopeOptions = [
	{
		...QueryScopePresentation.board,
		value: "board",
	},
	{
		...QueryScopePresentation.inventory,
		value: "inventory",
	},
	{
		...QueryScopePresentation.toolbar,
		value: "toolbar",
	},
	{
		...QueryScopePresentation.any,
		value: "any",
	},
	{
		...QueryScopePresentation.universe,
		value: "universe",
	},
] as const;

export const QueryScopeControl = ({
	error,
	onChangeFn,
	value,
}: {
	readonly error?: string;
	readonly onChangeFn: (query: QuerySchema.Type) => void;
	readonly value: QuerySchema.Type;
}) => {
	const translator = useTranslator();
	return (
		<EditorChoiceControl
			error={error}
			label={translator.textFn("Query scope")}
			value={value.scope}
			options={queryScopeOptions.map((option) => ({
				...option,
				label: translator.textFn(option.label),
				description:
					option.value === "board" ? (
						<Mx label="Query scope Board help" />
					) : option.value === "inventory" ? (
						<Mx label="Query scope Inventory help" />
					) : option.value === "toolbar" ? (
						<Mx label="Query scope Toolbar help" />
					) : option.value === "any" ? (
						<Mx label="Query scope Any local help" />
					) : (
						<Mx label="Query scope Universe help" />
					),
			}))}
			onChangeFn={(scope) =>
				onChangeFn(
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
};
