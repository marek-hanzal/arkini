import type { FC } from "react";

export namespace StatusPill {
	export interface Props {
		label: string;
		value: string;
	}
}

export const StatusPill: FC<StatusPill.Props> = ({ label, value }) => {
	return (
		<div className="min-w-0 rounded-sm border border-ak-border bg-ak-surface-soft px-3 py-2">
			<div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ak-text-muted">
				{label}
			</div>
			<div className="truncate text-sm font-semibold text-ak-text">{value}</div>
		</div>
	);
};
