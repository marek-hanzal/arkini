import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

interface ItemProductionRowProps {
	readonly activateFn?: () => void;
	readonly line: LineSchema.Type;
	readonly actions: ReactNode;
	readonly leadingControl?: ReactNode;
	readonly inputs: ReactNode;
	readonly backdrop?: ReactNode;
	readonly overlay?: ReactNode;
	readonly ruleDisabled?: boolean;
}

/** Shared production presentation; callers retain exact job/request identity and controls. */
export const ItemProductionRow = ({
	line,
	activateFn,
	actions,
	leadingControl,
	inputs,
	backdrop,
	overlay,
	ruleDisabled = false,
}: ItemProductionRowProps) => {
	return (
		<article
			className="group/production-row relative isolate px-3 transition-colors duration-300 ease-out data-[ui-clickable=true]:cursor-pointer hover:bg-surface-raised/30"
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
			<div className="relative isolate grid min-h-[17.6rem] grid-rows-[minmax(3.5rem,1fr)_auto_minmax(3.5rem,1fr)] py-3 transition-opacity duration-300 group-data-[ui-rule-disabled=true]/production-row:opacity-45">
				{backdrop}
				<div className="flex items-center gap-3 self-start">
					{leadingControl}
					<h3 className="min-w-0 text-xl font-semibold transition-colors duration-300 ease-out group-hover/production-row:text-accent">
						{line.title}
					</h3>
					<span className="inline-flex shrink-0 items-center gap-2 text-xl text-muted">
						<Clock className="size-8 shrink-0" />
						{formatDurationFn(line.runtimeMs)}
					</span>
					<div className="ml-auto flex shrink-0 items-center gap-8">{actions}</div>
				</div>
				{line.description ? (
					<p className="absolute bottom-3 left-0 w-fit max-w-[70%] rounded-lg bg-surface/50 px-3 py-2 text-left whitespace-pre-wrap text-muted">
						{line.description}
					</p>
				) : null}
				{inputs}
			</div>
			{overlay}
		</article>
	);
};
