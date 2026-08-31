import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface StatusProps {
	readonly action?: ReactNode;
	readonly dataUi?: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly iconSpin?: boolean;
	readonly title: string;
	readonly variant?: "card" | "flat";
}

/** Presents one deliberate empty or unavailable product state with an optional canonical action. */
export const Status = ({
	action,
	dataUi = "Status",
	description,
	icon,
	iconSpin = false,
	title,
	variant = "card",
}: StatusProps) => {
	const Icon = icon;
	return (
		<section
			className="grid min-h-48 place-items-center p-[var(--ak-panel-padding)] text-center data-[ui-variant=card]:rounded-2xl data-[ui-variant=card]:border data-[ui-variant=card]:border-line data-[ui-variant=card]:bg-surface/70"
			{...readDataUiFn({
				dataUi,
				state: {
					variant,
				},
			})}
		>
			<div className="grid max-w-md justify-items-center gap-3">
				<Icon
					className="size-7 text-subtle data-[ui-spin=true]:animate-spin"
					{...readDataUiFn({
						dataUi: "StatusIcon",
						state: {
							spin: iconSpin,
						},
					})}
				/>
				<div className="grid gap-1.5">
					<h2 className="text-base font-semibold text-foreground">{title}</h2>
					<p className="text-sm text-muted">{description}</p>
				</div>
				{action === undefined ? null : <div className="pt-1">{action}</div>}
			</div>
		</section>
	);
};
