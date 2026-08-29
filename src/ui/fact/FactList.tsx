import type { ReactNode } from "react";

export const FactList = ({ children }: { readonly children: ReactNode }) => (
	<dl className="ak-fact-list grid min-w-0 grid-cols-2 gap-x-8 max-[48rem]:grid-cols-1">
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
		className="grid min-w-0 gap-1 border-b border-line/70 py-3 last:border-b-0"
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
