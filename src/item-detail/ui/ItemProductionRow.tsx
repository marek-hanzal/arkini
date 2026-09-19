import type { ReactNode } from "react";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

interface ItemProductionRowProps {
	readonly line: LineSchema.Type;
	readonly actions: ReactNode;
	readonly inputs: ReactNode;
	readonly status?: ReactNode;
	readonly backdrop?: ReactNode;
	readonly footer?: ReactNode;
	readonly ruleDisabled?: boolean;
	readonly reserved?: boolean;
}

/** Shared production presentation; callers retain exact job/request identity and controls. */
export const ItemProductionRow = ({
	line,
	actions,
	inputs,
	status,
	backdrop,
	footer,
	ruleDisabled = false,
	reserved = false,
}: ItemProductionRowProps) => {
	return (
		<article
			className="group/production-row relative isolate flex min-h-48 flex-col justify-center py-[6.875rem] transition-opacity duration-300 data-[ui-rule-disabled=true]:opacity-45 data-[ui-reserved=true]:h-full data-[ui-reserved=true]:min-h-0 data-[ui-reserved=true]:justify-start data-[ui-reserved=true]:overflow-auto data-[ui-reserved=true]:py-4"
			{...readDataUiFn({
				dataUi: "ItemProductionRow",
				state: {
					ruleDisabled,
					reserved,
				},
			})}
			data-line-id={line.id}
		>
			{backdrop}
			<div className="min-h-0 group-data-[ui-reserved=true]/production-row:my-auto group-data-[ui-reserved=true]/production-row:shrink-0">
				<div className="flex items-center gap-3">
					<h3 className="min-w-0 text-lg font-semibold">{line.title}</h3>
					<span className="shrink-0 text-muted">
						· {formatDurationFn(line.runtimeMs)}
					</span>
					<div className="ml-auto flex shrink-0 items-center gap-8">{actions}</div>
				</div>
				{line.description ? (
					<p className="mt-2 w-fit max-w-full rounded-lg bg-surface/50 px-3 py-2 whitespace-pre-wrap text-muted">
						{line.description}
					</p>
				) : null}
				<div className="flex items-end justify-between gap-6">
					{inputs}
					<div className="mt-3 ml-auto flex min-h-5 shrink-0 items-center gap-5 text-sm">
						{status}
					</div>
				</div>
				{footer}
			</div>
		</article>
	);
};
