import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { ReactNode } from "react";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
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

const LineFlag = ({
	checked,
	label,
	description,
}: {
	readonly checked: boolean;
	readonly label: ReactNode;
	readonly description: ReactNode;
}) => {
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full border border-control-border bg-secondary-subtle px-2.5 py-1 text-xs font-semibold text-muted data-[ui-selected=true]:border-secondary-border data-[ui-selected=true]:bg-secondary-selected data-[ui-selected=true]:text-secondary-foreground"
			{...readDataUiFn({
				dataUi: "EditorProductionLineFlag",
				state: {
					selected: checked,
				},
			})}
		>
			{label}
			<EditorInfoTooltip content={description} />
		</span>
	);
};

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
		<EditorRootCard
			dataUi="EditorProductionLineDetail"
			data-line-id={line.id}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
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
						<LineFlag
							checked={line.default}
							label={<Tx label="Default" />}
							description={
								<Tx label="The authored line selected for ordinary item activation. The player can change Default independently of Clock." />
							}
						/>
						<LineFlag
							checked={line.clock === true}
							label={<Tx label="Clock" />}
							description={
								<Tx label="The authored line selected for automatic Clock impulses. Selecting Default does not change this selection." />
							}
						/>
						<LineFlag
							checked={line.show}
							label={<Tx label="Visible" />}
							description={
								<Tx label="Visible lines are shown to the player before runtime rules alter their visibility." />
							}
						/>
						<LineFlag
							checked={line.enable}
							label={<Tx label="Enabled" />}
							description={
								<Tx label="Enabled lines can accept production jobs before runtime rules alter their availability." />
							}
						/>
						<LineFlag
							checked={line.ahead === true}
							label={<Tx label="Check ahead" />}
							description={
								<Tx label="Before this item is produced, check one future run against item count limits. Only checked lines that are shown and enabled by default participate; one fitting alternative is enough. This looks one step ahead and reserves no future output." />
							}
						/>
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<LineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
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
			<RulesDetail
				rules={line.rules}
				description={translator.textFn(
					"Every condition of a rule must pass. Show and Hide control visibility; Enable rules must all pass and Disable vetoes availability. Runtime multipliers apply before signed runtime adjustments.",
				)}
			/>
		</EditorRootCard>
	);
};
