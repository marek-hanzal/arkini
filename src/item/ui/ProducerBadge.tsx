import type { FC } from "react";
import type { ProducerUiState } from "~/item/logic/ProducerUiState";
import { cn } from "~/shared/cn";

export namespace ProducerBadge {
	export interface Props {
		ui: ProducerUiState;
	}
}

export const ProducerBadge: FC<ProducerBadge.Props> = ({ ui }) => {
	return (
		<span
			title={ui.title}
			className={cn(
				"absolute left-0.5 top-0.5 min-w-5 overflow-hidden rounded-sm px-1 pb-0.5 pt-0.5 text-center text-[0.56rem] font-black shadow-sm",
				ui.waiting
					? "bg-slate-950/82 text-emerald-200"
					: "bg-emerald-300/18 text-emerald-100 ring-1 ring-emerald-200/45",
			)}
		>
			<span>{ui.label}</span>
			{ui.progress !== undefined ? (
				<span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-sm bg-slate-700/80">
					<span
						className="block h-full bg-emerald-300/80"
						style={{
							width: `${ui.progress * 100}%`,
						}}
					/>
				</span>
			) : null}
		</span>
	);
};
