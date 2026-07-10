import type { FC, PropsWithChildren, ReactNode } from "react";

export namespace DetailSection {
	export interface Props extends PropsWithChildren {
		title: string;
		description?: string;
	}
}

export const DetailSection: FC<DetailSection.Props> = ({ title, description, children }) => (
	<section className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
		<div>
			<h3 className="text-sm font-semibold text-slate-100">{title}</h3>
			{description ? (
				<p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
			) : null}
		</div>
		<div className="mt-4">{children}</div>
	</section>
);

export namespace DetailField {
	export interface Props {
		label: string;
		value: ReactNode;
	}
}

export const DetailField: FC<DetailField.Props> = ({ label, value }) => (
	<div className="min-w-0">
		<dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
			{label}
		</dt>
		<dd className="mt-1 break-words text-sm text-slate-200">{value}</dd>
	</div>
);

export namespace CodePill {
	export interface Props {
		children: ReactNode;
		tone?: "default" | "violet" | "emerald" | "amber" | "rose";
	}
}

const toneClassName: Record<NonNullable<CodePill.Props["tone"]>, string> = {
	default: "border-slate-700 bg-slate-800/70 text-slate-300",
	violet: "border-violet-900/70 bg-violet-950/60 text-violet-200",
	emerald: "border-emerald-900/70 bg-emerald-950/60 text-emerald-200",
	amber: "border-amber-900/70 bg-amber-950/60 text-amber-200",
	rose: "border-rose-900/70 bg-rose-950/60 text-rose-200",
};

export const CodePill: FC<CodePill.Props> = ({ children, tone = "default" }) => (
	<span
		className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 font-mono text-xs ${toneClassName[tone]}`}
	>
		{children}
	</span>
);
