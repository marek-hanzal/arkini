import type { FC, ReactNode } from "react";
import { cn } from "~/v0/ui/cn";

export namespace DetailCard {
	export interface Props {
		action?: ReactNode;
		children?: ReactNode;
		className?: string;
		eyebrow?: string;
		title?: string;
	}
}

export const DetailCard: FC<DetailCard.Props> = ({
	action,
	children,
	className,
	eyebrow,
	title,
}) => (
	<section
		className={cn(
			"overflow-hidden rounded-sm border border-ak-border bg-ak-surface-elevated",
			className,
		)}
	>
		{eyebrow || title || action ? (
			<header className="flex min-w-0 items-start justify-between gap-3 border-b border-ak-border/70 px-3.5 py-3">
				<div className="min-w-0">
					{eyebrow ? (
						<p className="text-[0.65rem] font-black uppercase tracking-[0.32em] text-ak-primary">
							{eyebrow}
						</p>
					) : null}
					{title ? (
						<h3
							className={cn(
								"break-words text-base font-black leading-6 text-ak-text",
								eyebrow && "mt-1",
							)}
						>
							{title}
						</h3>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</header>
		) : null}
		<div className="min-w-0 p-3.5">{children}</div>
	</section>
);

export const DetailMutedPill: FC<{
	children: ReactNode;
	className?: string;
}> = ({ children, className }) => (
	<span
		className={cn(
			"rounded-full border border-ak-border bg-ak-surface-soft px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-ak-text-muted",
			className,
		)}
	>
		{children}
	</span>
);

export const DetailTabs: FC<{
	items: readonly {
		count?: number;
		id: string;
		label: string;
	}[];
	selectedId: string;
	onSelect(id: string): void;
}> = ({ items, onSelect, selectedId }) => (
	<div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
		{items.map((item) => (
			<button
				key={item.id}
				type="button"
				className={cn(
					"shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition-[background,border-color,color,transform] active:translate-y-px",
					item.id === selectedId
						? "border-ak-border-accent bg-ak-primary text-white"
						: "border-ak-border bg-ak-surface-soft text-ak-text-muted hover:border-ak-border-accent hover:text-ak-text",
				)}
				onClick={() => onSelect(item.id)}
			>
				{item.label}
				{item.count !== undefined ? (
					<span className="ml-1 opacity-70">{item.count}</span>
				) : null}
			</button>
		))}
	</div>
);
