import type { ReactNode } from "react";

export const FactList = ({
	children,
	columns = 2,
}: {
	readonly children: ReactNode;
	readonly columns?: 1 | 2 | 3;
}) => (
	<dl
		className="ak-fact-list grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 min-[48rem]:data-[columns=2]:grid-cols-2 min-[48rem]:data-[columns=3]:grid-cols-3"
		data-columns={columns}
	>
		{children}
	</dl>
);

export const Fact = ({
	dataUi,
	label,
	mono = false,
	value,
}: {
	readonly dataUi?: string;
	readonly label: string;
	readonly mono?: boolean;
	readonly value: ReactNode;
}) => (
	<div
		className="grid min-w-0 gap-1"
		data-ui={dataUi}
		data-label={label}
	>
		<dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
		<dd
			className={`min-w-0 text-pretty text-sm font-medium leading-snug text-foreground ${
				mono ? "break-all font-mono" : ""
			}`}
		>
			{value}
		</dd>
	</div>
);
