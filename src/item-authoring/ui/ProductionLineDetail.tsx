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
import { Mx } from "~/translation/ui/Mx";
import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";

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
			<EditorInfoTooltip content={<Mx label="Authored production runtime summary help" />} />
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
						{line.artwork === undefined ? null : (
							<EditorResourceThumbnail
								resourceId={line.artwork}
								size="sm"
							/>
						)}
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
							description={<Mx label="Authored production Default marker help" />}
						/>
						<LineFlag
							checked={line.clock === true}
							label={<Tx label="Clock" />}
							description={<Mx label="Authored production Clock marker help" />}
						/>
						<LineFlag
							checked={line.show}
							label={<Tx label="Visible" />}
							description={<Mx label="Authored production Visible marker help" />}
						/>
						<LineFlag
							checked={line.enable}
							label={<Tx label="Enabled" />}
							description={<Mx label="Authored production Enabled marker help" />}
						/>
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<LineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<section className="min-w-0">
					<h4 className="flex items-center gap-1 border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
						{translator.textFn("Inputs")}
						<EditorInfoTooltip
							content={<Mx label="Authored production inputs summary help" />}
						/>
					</h4>
					<div className="pt-3">
						<ProductionLineInputs input={line.input} />
					</div>
				</section>
				<div
					className="grid place-items-center text-muted"
					data-ui="EditorProductionLineFlowChevron"
				>
					<ChevronRight className="size-5" />
				</div>
				<OutputDetail
					emptyLabel={translator.textFn("No output")}
					description={<Mx label="Authored production output summary help" />}
					output={line.output}
				/>
			</div>
			<RulesDetail rules={line.rules} />
		</EditorRootCard>
	);
};
