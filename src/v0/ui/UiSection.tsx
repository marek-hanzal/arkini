import type { FC, ReactNode } from "react";
import { cn } from "~/v0/ui/cn";

export namespace UiSection {
	export interface Props {
		title?: string;
		eyebrow?: string;
		action?: ReactNode;
		children?: ReactNode;
		className?: string;
		bodyClassName?: string;
	}
}

export const UiSection: FC<UiSection.Props> = ({
	action,
	bodyClassName,
	children,
	className,
	eyebrow,
	title,
}) => (
	<section className={cn("rounded-sm border border-ak-border bg-ak-surface-elevated", className)}>
		{title || eyebrow || action ? (
			<div className="flex items-start justify-between gap-3 px-3.5 pt-3.5">
				<div className="min-w-0">
					{eyebrow ? (
						<p className="text-[0.65rem] font-extrabold uppercase tracking-[0.28em] text-ak-primary">
							{eyebrow}
						</p>
					) : null}
					{title ? (
						<h3
							className={cn(
								"min-w-0 text-base font-bold text-ak-text",
								eyebrow && "mt-1",
							)}
						>
							{title}
						</h3>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
		) : null}
		<div className={cn("px-3.5 pb-3.5", (title || eyebrow || action) && "pt-3", bodyClassName)}>
			{children}
		</div>
	</section>
);
