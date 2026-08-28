import { ArrowUpRight, ChevronRight } from "lucide-react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorProductionLineEditLink } from "~/ui/item/editor/EditorProductionLineEditLink";
import { EditorProductionLineInputs } from "~/ui/item/editor/EditorProductionLineInputs";
import { EditorProductionLineOutputs } from "~/ui/item/editor/EditorProductionLineOutputs";

const EditorLineRuntime = ({ runtimeMs }: { readonly runtimeMs: number }) => (
	<div className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right">
		<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
		<div className="col-start-1 row-span-2 row-start-2 grid grid-rows-[1.5rem_1rem]">
			<p className="self-center font-semibold tabular-nums text-foreground">
				{RendererRuntime.runSync(formatItemDurationFx(runtimeMs))}
			</p>
			<p className="self-end text-xs tabular-nums text-muted">Per cycle</p>
		</div>
	</div>
);

/** Composes authored line identity, runtime, inputs, and outputs without runtime state. */
export const EditorProductionLineDetail = ({
	itemUid,
	line,
}: {
	readonly itemUid: string;
	readonly line: EditorLine;
}) => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	return (
		<article
			className="ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line border-l-line/55 px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5"
			data-ui="EditorProductionLineDetail"
			data-line-id={line.id}
		>
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							<EditorProductionLineEditLink
								dataUi="EditorProductionLineDetailEditLink"
								itemUid={itemUid}
								lineId={line.id}
							>
								{line.title}
								<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
							</EditorProductionLineEditLink>
						</h3>
						{!line.enable ? (
							<span className="rounded-full border border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Disabled
							</span>
						) : null}
						{line.default ? (
							<span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Default
							</span>
						) : null}
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<EditorLineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<EditorProductionLineInputs
					input={line.input}
					items={items}
					projectId={project.projectId}
				/>
				<div
					className="grid place-items-center text-muted"
					data-ui="EditorProductionLineFlowChevron"
				>
					<ChevronRight className="size-5" />
				</div>
				<EditorProductionLineOutputs
					items={items}
					output={line.output}
					projectId={project.projectId}
				/>
			</div>
		</article>
	);
};
