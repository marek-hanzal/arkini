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
		data-ui="detail section"
		className={cn("min-w-0", className)}
	>
		{eyebrow || title || action ? (
			<header className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0">
					{eyebrow ? (
						<p className="text-[0.62rem] font-black uppercase tracking-[0.28em] text-ak-primary">
							{eyebrow}
						</p>
					) : null}
					{title && !eyebrow ? (
						<h3 className="break-words text-base font-black leading-5 text-ak-text">
							{title}
						</h3>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</header>
		) : null}
		<div className={cn("min-w-0", (eyebrow || title || action) && "mt-3")}>{children}</div>
	</section>
);

export const DetailSeparator: FC<{
	className?: string;
}> = ({ className }) => (
	<div
		aria-hidden="true"
		className={cn("border-t border-violet-300/18", className)}
		data-ui="detail separator"
	/>
);

export const DetailMutedPill: FC<{
	children: ReactNode;
	className?: string;
}> = ({ children, className }) => (
	<span
		className={cn(
			"rounded-full border border-violet-300/30 bg-violet-300/12 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-violet-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
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
	<div className="flex flex-wrap gap-1 pb-1">
		{items.map((item) => (
			<button
				key={item.id}
				type="button"
				className={cn(
					"shrink-0 rounded-full border px-3 py-1.5 text-xs font-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-[background,border-color,color,transform,opacity] active:translate-y-px",
					item.id === selectedId
						? "border-fuchsia-300/75 bg-ak-primary text-white"
						: "border-violet-300/25 bg-violet-300/10 text-violet-100/75 hover:border-ak-border-accent hover:bg-ak-primary-soft hover:text-ak-text",
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
