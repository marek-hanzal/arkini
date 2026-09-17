import type { ReactNode } from "react";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { projectAuthoredOutputFn } from "~/production-output/fn/projectAuthoredOutputFn";
import { Outputs } from "~/production-output/ui/Outputs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { Mx } from "~/translation/ui/Mx";

/** Renders canonical authored output through the shared output presentation. */
export const OutputDetail = ({
	emptyLabel,
	output,
	title,
	description,
}: {
	readonly emptyLabel?: string;
	readonly output?: OutputSchema.Type;
	readonly title?: ReactNode;
	readonly description?: ReactNode;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const items = project.config.items;
	return (
		<section
			className="min-w-0"
			data-ui="EditorOutputDetail"
		>
			<h4 className="flex items-center gap-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
				{title ?? translator.textFn("Outputs")}
				<EditorInfoTooltip
					content={description ?? <Mx label="Authored output summary help" />}
				/>
			</h4>
			{output?.set.length === 1 ? <div className="mb-3 border-t border-line" /> : null}
			<Outputs
				emptyLabel={emptyLabel ?? translator.textFn("No output configured.")}
				output={projectAuthoredOutputFn(output, items)}
				renderItemDetailFn={(item) =>
					item.rules.length === 0 ? null : (
						<div className="ml-24">
							<RulesDetail rules={item.rules} />
						</div>
					)
				}
				renderItemFn={(item, eyebrow) => (
					<DetailReference
						eyebrow={eyebrow}
						itemId={item.itemId}
						description={<Tx label={item.placement === "random" ? "Random" : "Drop"} />}
					/>
				)}
				renderSetDetailFn={(set) =>
					set.rules === undefined || set.rules.length === 0 ? null : (
						<div className="mb-3 grid gap-3">
							<EditorFormSectionDivider
								title={translator.textFn("Rules")}
								variant="secondary"
							/>
							<RulesDetail rules={set.rules} />
							<EditorFormSectionDivider
								title={translator.textFn("Items")}
								variant="secondary"
							/>
						</div>
					)
				}
				variant="editor-tree"
			/>
		</section>
	);
};
