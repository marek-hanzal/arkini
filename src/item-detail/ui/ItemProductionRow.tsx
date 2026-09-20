import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

interface ItemProductionRowProps {
	readonly activateFn?: () => void;
	readonly line: LineSchema.Type;
	readonly actions: ReactNode;
	readonly inputs: ReactNode;
	readonly status?: ReactNode;
	readonly backdrop?: ReactNode;
	readonly overlay?: ReactNode;
	readonly ruleDisabled?: boolean;
}

/** Shared production presentation; callers retain exact job/request identity and controls. */
export const ItemProductionRow = ({
	line,
	activateFn,
	actions,
	inputs,
	status,
	backdrop,
	overlay,
	ruleDisabled = false,
}: ItemProductionRowProps) => {
	return (
		<article
			className="group/production-row relative isolate transition-colors duration-300 ease-out data-[ui-clickable=true]:cursor-pointer hover:bg-surface-raised/30"
			{...readDataUiFn({
				dataUi: "ItemProductionRow",
				state: {
					clickable: activateFn !== undefined,
					ruleDisabled,
				},
			})}
			onClick={(event) => {
				if (event.defaultPrevented || !(event.target instanceof Element)) return;
				// Nested controls own their clicks, including disabled buttons and their artwork.
				if (event.target.closest("button, a, input, select, textarea, [contenteditable]"))
					return;
				activateFn?.();
			}}
			data-line-id={line.id}
		>
			<div className="relative isolate flex min-h-48 flex-col justify-center py-[6.875rem] transition-opacity duration-300 group-data-[ui-rule-disabled=true]/production-row:opacity-45">
				{backdrop}
				<div className="flex items-center gap-3">
					<h3 className="min-w-0 text-lg font-semibold transition-colors duration-300 ease-out group-hover/production-row:text-accent">
						{line.title}
					</h3>
					<span className="inline-flex shrink-0 items-center gap-2 text-muted">
						<Clock className="size-[1em] shrink-0" />
						{formatDurationFn(line.runtimeMs)}
					</span>
					<div className="ml-auto flex shrink-0 items-center gap-8">{actions}</div>
				</div>
				{line.description ? (
					<p className="absolute right-0 bottom-3 w-fit max-w-[70%] rounded-lg bg-surface/50 px-3 py-2 text-right whitespace-pre-wrap text-muted">
						{line.description}
					</p>
				) : null}
				<div className="flex items-end justify-between gap-6">
					{inputs}
					<div className="mt-3 ml-auto flex min-h-5 shrink-0 items-center gap-5 text-sm">
						{status}
					</div>
				</div>
			</div>
			{overlay}
		</article>
	);
};
