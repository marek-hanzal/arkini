import { LocateFixed, Focus, Scan, Radar, Telescope } from "lucide-react";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

const boardDistanceOptions = [
	{
		...BoardDistancePresentation.self,
		value: "self",
		icon: <LocateFixed className="size-4 shrink-0" />,
	},
	{
		...BoardDistancePresentation.close,
		value: "close",
		icon: <Focus className="size-4 shrink-0" />,
	},
	{
		...BoardDistancePresentation["near-close"],
		value: "near-close",
		icon: <Scan className="size-4 shrink-0" />,
	},
	{
		...BoardDistancePresentation.near,
		value: "near",
		icon: <Radar className="size-4 shrink-0" />,
	},
	{
		...BoardDistancePresentation.far,
		value: "far",
		icon: <Telescope className="size-4 shrink-0" />,
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
