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
		...BoardDistancePresentation.near,
		value: "near",
	},
	{
		...BoardDistancePresentation.far,
		value: "far",
	},
] as const;

export const BoardDistanceControl = ({
	error,
	onChangeFn,
	value,
}: {
	readonly error?: string;
	readonly onChangeFn: (query: QuerySchema.Type) => void;
	readonly value: Extract<
		QuerySchema.Type,
		{
			readonly scope: "board";
		}
	>;
}) => {
	const translator = useTranslator();
	return (
		<EditorChoiceControl
			error={error}
			label={translator.textFn("Board distance")}
			value={value.distance}
			options={boardDistanceOptions.map((option) => ({
				...option,
				label: translator.textFn(option.label),
				description:
					option.value === "self" ? (
						<Mx label="Board distance Self help" />
					) : option.value === "close" ? (
						<Mx label="Board distance Close help" />
					) : option.value === "near" ? (
						<Mx label="Board distance Near help" />
					) : (
						<Mx label="Board distance Far help" />
					),
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
