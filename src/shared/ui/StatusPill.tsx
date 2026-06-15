import type { FC } from "react";

export namespace StatusPill {
	export interface Props {
		label: string;
		value: string;
	}
}

export const StatusPill: FC<StatusPill.Props> = ({ label, value }) => {
	return (
		<div className="min-w-0 rounded-sm bg-slate-950/60 px-3 py-2">
			<div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{label}</div>
			<div className="truncate text-sm font-medium text-slate-100">{value}</div>
		</div>
	);
};
