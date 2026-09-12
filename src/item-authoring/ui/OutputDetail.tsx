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

const AuthoredOutputItemDetail = ({ item }: { readonly item: OutputProjection.AuthoredItem }) => {
	const translator = useTranslator();
	return item.placement === "drop" && item.rules.length === 0 ? null : (
		<div className="grid gap-2 text-xs text-muted">
			{item.placement === "drop" ? null : (
				<p>
					<span className="font-medium uppercase tracking-[0.08em]">
						<Tx label="Placement" />
					</span>{" "}
					· <Tx label={item.placement === "random" ? "Random" : "Drop"} />
				</p>
			)}
			{item.rules.length === 0 ? null : (
				<RulesDetail
					rules={item.rules}
					description={translator.textFn(
						"Every condition of a rule must pass. Enable rules gate this selected drop; a matching Disable rule suppresses it without disabling the line or other drops.",
					)}
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
	readonly title?: string;
	readonly description?: string;
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
						content={
							description ??
							translator.textFn(
								"One weighted alternative is selected, then its guaranteed, chance, and weighted rolls determine the output. Placement and rules apply to each selected drop.",
							)
						}
					/>
				</span>
			}
		/>
	);
};
