import type { ReactNode } from "react";
import type { SpaceDestinationSchema } from "~/game-value/schema/SpaceDestinationSchema";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Shared authored destination choice for navigation outcomes and receiver transport. */
export const SpaceDestinationControl = ({
	value,
	onChangeFn,
	description,
	error,
	trailing,
}: {
	readonly value: SpaceDestinationSchema.Type;
	readonly onChangeFn: (space: SpaceDestinationSchema.Type) => void;
	readonly description: ReactNode;
	readonly error?: string;
	readonly trailing?: ReactNode;
}) => {
	const translator = useTranslator();
	return (
		<div
			className="grid gap-1.5"
			data-ui="SpaceDestinationControl"
		>
			<EditorChoiceControl
				label={translator.textFn("Target space")}
				description={description}
				error={value === "previous" ? error : undefined}
				value={value === "previous" ? "previous" : "exact"}
				options={[
					{
						value: "exact",
						label: translator.textFn("Space"),
					},
					{
						value: "previous",
						label: translator.textFn("Previous Space"),
					},
				]}
				onChangeFn={(destination) =>
					onChangeFn(
						destination === "previous" ? "previous" : value === "previous" ? 0 : value,
					)
				}
			/>
			{value === "previous" ? null : (
				<EditorNumberControl
					label={translator.textFn("Target space")}
					labelVisible={false}
					min={0}
					value={value}
					onChangeFn={onChangeFn}
					error={error}
					trailing={trailing}
				/>
			)}
		</div>
	);
};
