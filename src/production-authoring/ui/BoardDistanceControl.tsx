import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

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
		...BoardDistancePresentation["near-close"],
		value: "near-close",
	},
	{
		...BoardDistancePresentation.near,
		value: "near",
	},
	{
		...BoardDistancePresentation.far,
		value: "far",
	},
	{
		...BoardDistancePresentation.universe,
		value: "universe",
	},
] as const;

export const BoardDistanceControl = ({
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
			label={translator.textFn("Search area")}
			value={value.distance}
			options={boardDistanceOptions.map((option) => ({
				...option,
				label: translator.textFn(option.label),
				description: <Mx label={option.description} />,
			}))}
			onChangeFn={(distance) =>
				onChangeFn({
					...value,
					distance,
				})
			}
		/>
	);
};
