import { ArrowUpRight, ChevronRight } from "lucide-react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";

const LineRuntime = ({ runtimeMs }: { readonly runtimeMs: number }) => (
	<div className="grid min-w-32 gap-1 text-right">
		<p className="flex items-center justify-end gap-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">
			<Tx label="Runtime" />
			<EditorInfoTooltip
				content={
					<Tx label="Time for one production cycle before runtime rules. Zero completes immediately." />
				}
			/>
		</p>
		<div className="grid">
			<p className="self-center font-semibold tabular-nums text-foreground">
				{formatDurationFn(runtimeMs)}
			</p>
		</div>
	</div>
);

/** Composes authored line identity, runtime, inputs, and outputs without runtime state. */
export const ProductionLineDetail = ({
	itemUid,
	line,
}: {
	readonly itemUid: string;
	readonly line: LineSchema.Type;
}) => {
	const translator = useTranslator();
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
							<LineEditLink
								dataUi="EditorProductionLineDetailEditLink"
								itemUid={itemUid}
								lineId={line.id}
							>
								{line.title}
								<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
							</LineEditLink>
						</h3>
						{!line.enable ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								<Tx label="Disabled" />
								<EditorInfoTooltip
									content={
										<Tx label="Disabled before rules are evaluated. Enable rules can make this line available; a matching Disable rule vetoes availability." />
									}
								/>
							</span>
						) : null}
						{line.default ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								<Tx label="Default" />
								<EditorInfoTooltip
									content={
										<Tx label="The authored line selected for ordinary item activation. The player can change Default independently of Clock." />
									}
								/>
							</span>
						) : null}
						{line.clock === true ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								<Tx label="Clock" />
								<EditorInfoTooltip
									content={
										<Tx label="The authored line selected for automatic Clock impulses. Selecting Default does not change this selection." />
									}
								/>
							</span>
						) : null}
						{!line.show ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-foreground">
								<Tx label="Hidden" />
								<EditorInfoTooltip
									content={
										<Tx label="Hidden before rules are evaluated. Show rules can reveal this line; a matching Hide rule vetoes visibility." />
									}
								/>
							</span>
						) : null}

						{line.ahead === true ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								<Tx label="Check ahead" />
								<EditorInfoTooltip
									content={
										<Tx label="Before this item is produced, check one future run against item count limits. Only checked lines that are shown and enabled by default participate; one fitting alternative is enough. This looks one step ahead and reserves no future output." />
									}
								/>
							</span>
						) : null}
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<LineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<ProductionLineInputs input={line.input} />
				<div
					className="grid place-items-center text-muted"
					data-ui="EditorProductionLineFlowChevron"
				>
					<ChevronRight className="size-5" />
				</div>
				<OutputDetail
					emptyLabel={translator.textFn("No output")}
					description={translator.textFn(
						"This line can complete without producing an item. Configured output is resolved through its alternatives, rolls, and drop rules.",
					)}
					output={line.output}
				/>
			</div>
			<div className="mt-4">
				<RulesDetail
					rules={line.rules}
					description={translator.textFn(
						"Every condition of a rule must pass. Show and Hide control visibility; Enable rules must all pass and Disable vetoes availability. Runtime multipliers apply before signed runtime adjustments.",
					)}
				/>
			</div>
		</article>
	);
};
