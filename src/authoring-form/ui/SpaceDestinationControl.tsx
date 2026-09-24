import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { TemplateSelector } from "~/template-authoring/ui/TemplateSelector";
import type { ReactNode } from "react";
import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Shared authored destination choice for navigation outcomes and receiver transport. */
export const SpaceDestinationControl = ({
	value,
	onChangeFn,
	description,
	error,
	kindEditable = true,
	trailing,
	layout = "stacked",
}: {
	readonly value: SpaceDestinationSchema.Type;
	readonly onChangeFn: (space: SpaceDestinationSchema.Type) => void;
	readonly description?: ReactNode;
	readonly error?: string;
	readonly kindEditable?: boolean;
	readonly trailing?: ReactNode;
	readonly layout?: "stacked" | "columns";
}) => {
	const translator = useTranslator();
	const project = useEditorProject();
	return (
		<div
			className="grid min-w-0 content-start items-start gap-1.5 data-[ui-layout=columns]:grid-cols-2 data-[ui-layout=columns]:gap-x-[var(--ak-panel-padding)]"
			{...readDataUiFn({
				dataUi: "SpaceDestinationControl",
				state: {
					layout,
				},
			})}
		>
			{kindEditable ? (
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
			) : null}
			{kindEditable || value !== "previous" ? (
				<div
					className={
						kindEditable
							? "min-w-0 min-h-[calc(1.25rem+var(--ak-control-min-height))]"
							: "min-w-0"
					}
				>
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
							label={translator.textFn("Space number")}
							description={<Mx label="Space number help" />}
							min={0}
							value={value}
							onChangeFn={onChangeFn}
							error={error}
							trailing={trailing}
						/>
					)}
				</div>
			) : null}
		</div>
	);
};
