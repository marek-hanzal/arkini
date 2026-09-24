import type { ReactNode } from "react";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { projectAuthoredOutcomeFn } from "~/outcome/fn/projectAuthoredOutcomeFn";
import { Outcomes } from "~/outcome/ui/Outcomes";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { Mx } from "~/translation/ui/Mx";
import { TemplateDetailReference } from "~/template-authoring/ui/TemplateDetailReference";

/** Renders canonical authored outcome through the shared outcome presentation. */
export const OutcomeDetail = ({
	emptyLabel,
	outcome,
	title,
	description,
}: {
	readonly emptyLabel?: string;
	readonly outcome?: OutcomeTableSchema.Type;
	readonly title?: ReactNode;
	readonly description?: ReactNode;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const items = project.config.items;
	return (
		<section
			className="min-w-0"
			data-ui="EditorOutcomeDetail"
		>
			<h4 className="flex items-center gap-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
				{title ?? translator.textFn("Outcomes")}
				<EditorInfoTooltip
					content={description ?? <Mx label="Authored outcome summary help" />}
				/>
			</h4>
			{outcome?.set.length === 1 ? <div className="mb-3 border-t border-line" /> : null}
			<Outcomes
				emptyLabel={emptyLabel ?? translator.textFn("No outcome configured.")}
				outcome={projectAuthoredOutcomeFn(outcome, items, project.config.templates)}
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
						itemUid={item.itemUid}
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
				renderTemplateReferenceFn={(templateUid, label) => (
					<TemplateDetailReference templateUid={templateUid}>
						{label}
					</TemplateDetailReference>
				)}
				variant="editor-tree"
			/>
		</section>
	);
};
