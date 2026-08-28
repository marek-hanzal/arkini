import type { ReactNode } from "react";

export const ItemTypeLabel = {
	blueprint: "Blueprint",
	craft: "Craft owner",
	deposit: "Resource deposit",
	inventory: "Inventory control",
	producer: "Producer",
	simple: "Simple item",
	space: "Space item",
	stash: "Stash",
	temporary: "Temporary item",
} as const;

export const ItemStorageScopeLabel = {
	any: "Board, Inventory & Toolbar",
	board: "Board only",
	inventory: "Inventory only",
	toolbar: "Toolbar only",
} as const;

export const ItemInfoFacts = ({ children }: { readonly children: ReactNode }) => (
	<dl className="ak-item-info-facts grid min-w-0 grid-cols-2 gap-x-8 max-[48rem]:grid-cols-1">
		{children}
	</dl>
);

export const ItemInfoFact = ({
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
