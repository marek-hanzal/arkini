import type { ReactNode } from "react";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import { projectAuthoredOutputFn } from "~/production-output/fn/projectAuthoredOutputFn";
import { Outputs } from "~/production-output/ui/Outputs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { Mx } from "~/translation/ui/Mx";

const AuthoredOutputItemDetail = ({ item }: { readonly item: OutputProjection.AuthoredItem }) => {
	return (
		<div className="grid gap-2 text-xs text-muted">
			<p>
				<span className="font-medium uppercase tracking-[0.08em]">
					<Tx label="Placement" />
				</span>{" "}
				· <Tx label={item.placement === "random" ? "Random" : "Drop"} />
			</p>
			{item.rules.length === 0 ? null : (
				<RulesDetail
					rules={item.rules}
					description={<Mx label="Authored drop rules summary help" />}
				/>
			)}
		</div>
	);
};

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
		<Outputs
			emptyLabel={emptyLabel ?? translator.textFn("No output configured.")}
			output={projectAuthoredOutputFn(output, items)}
			renderItemDetailFn={(item) => <AuthoredOutputItemDetail item={item} />}
			renderItemFn={(item) => <DetailReference itemId={item.itemId} />}
			title={
				<span className="flex items-center gap-1">
					{title ?? translator.textFn("Outputs")}
					<EditorInfoTooltip
						content={description ?? <Mx label="Authored output summary help" />}
					/>
				</span>
			}
		/>
	);
};
