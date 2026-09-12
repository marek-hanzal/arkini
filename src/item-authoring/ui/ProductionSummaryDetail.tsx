import { ArrowRight, ArrowUpRight, Factory } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";
import { LinkButtonLink } from "~/ui/ui/LinkButton";

/** Keeps the item overview to two authored lines, with full output semantics. */
export const ProductionSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const project = useEditorProject();
	return item.lines.length === 0 ? (
		<EditorRootCard dataUi="EditorItemProductionDisabledCard">
			<DisabledCapabilityDetail
				capability="production"
				itemUid={item.uid}
				title={translator.textFn("Item production empty title")}
				actionLabel={translator.textFn("Enable")}
				icon={Factory}
			/>
		</EditorRootCard>
	) : (
		<div
			className="grid content-start gap-3"
			data-ui="EditorItemProductionSummaryContent"
		>
			{item.lines.slice(0, 2).map((line) => (
				<EditorRootCard
					key={line.id}
					dataUi="EditorItemProductionOutputCard"
				>
					<OutputDetail
						output={line.output}
						title={
							<LineEditLink
								itemUid={item.uid}
								lineId={line.id}
							>
								{line.title}
								<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
							</LineEditLink>
						}
						emptyLabel={translator.textFn("No output")}
						description={translator.textFn(
							"This line can complete without producing an item. Configured output is resolved through its alternatives, rolls, and drop rules.",
						)}
					/>
				</EditorRootCard>
			))}
			{item.lines.length > 2 ? (
				<EditorRootCard dataUi="EditorItemProductionMoreCard">
					<div className="flex items-center justify-between gap-4 text-sm">
						<p className="text-muted">{translator.textFn("More entries are available.")}</p>
						<LinkButtonLink
							className="inline-flex shrink-0 items-center gap-1.5"
							to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
							params={{
								projectId: project.projectId,
								itemUid: item.uid,
								sectionId: "production",
							}}
						>
							{translator.textFn("Show all")}
							<ArrowRight className="size-4" />
						</LinkButtonLink>
					</div>
				</EditorRootCard>
			) : null}
		</div>
	);
};
