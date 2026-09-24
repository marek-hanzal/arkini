import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { TemplateSelector } from "~/template-authoring/ui/TemplateSelector";
import type { ReactNode } from "react";
import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
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
	const project = useEditorProject();
	return (
		<div
			className="grid gap-1.5"
			data-ui="SpaceDestinationControl"
		>
			<EditorChoiceControl
				label={translator.textFn("Target space")}
				description={description}
				error={value === "previous" ? error : undefined}
				value={
					typeof value === "object"
						? "generated"
						: value === "previous"
							? "previous"
							: "exact"
				}
				options={[
					{
						value: "exact",
						label: translator.textFn("Space"),
					},
					{
						value: "previous",
						label: translator.textFn("Previous Space"),
					},
					{
						value: "generated",
						label: translator.textFn("Generated Space"),
					},
				]}
				onChangeFn={(destination) =>
					onChangeFn(
						destination === "previous"
							? "previous"
							: destination === "generated"
								? {
										type: "generated",
										templateUid:
											typeof value === "object"
												? value.templateUid
												: (project.config.templates?.[0]?.uid ?? ""),
									}
								: typeof value === "number"
									? value
									: 0,
					)
				}
			/>
			{typeof value === "object" ? (
				<TemplateSelector
					templates={project.config.templates ?? []}
					value={value.templateUid}
					onChangeFn={(templateUid) =>
						onChangeFn({
							type: "generated",
							templateUid,
						})
					}
					error={error}
				/>
			) : value === "previous" ? null : (
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
