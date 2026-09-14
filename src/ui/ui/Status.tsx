import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface StatusProps {
	readonly action?: ReactNode;
	readonly dataUi?: string;
	readonly description?: ReactNode;
	readonly icon: LucideIcon;
	readonly iconSpin?: boolean;
	readonly iconTone?: "default" | "muted" | "warning" | "primary";
	readonly title: ReactNode;
	readonly size?: "normal" | "large";
	readonly variant?: "card" | "flat";
}

/** Presents one deliberate empty or unavailable product state with an optional canonical action. */
export const Status = ({
	action,
	dataUi = "Status",
	description,
	icon,
	iconSpin = false,
	iconTone = "default",
	title,
	size = "normal",
	variant = "card",
}: StatusProps) => {
	const Icon = icon;
	return (
		<section
			className="group/status grid min-w-0 min-h-48 place-items-center data-[ui-size=large]:min-h-80 data-[ui-size=large]:flex-1 p-[var(--ak-panel-padding)] text-center data-[ui-variant=card]:rounded-2xl data-[ui-variant=card]:border data-[ui-variant=card]:border-line data-[ui-variant=card]:bg-surface/70"
			{...readDataUiFn({
				dataUi,
				state: {
					variant,
					size,
				},
			})}
		>
			<div className="grid w-full min-w-0 max-w-md justify-items-center gap-3">
				<Icon
					className="size-7 text-subtle group-data-[ui-size=large]/status:size-16 data-[ui-tone=default]:group-data-[ui-size=large]/status:text-accent data-[ui-spin=true]:animate-spin data-[ui-tone=muted]:text-muted data-[ui-tone=warning]:text-warning data-[ui-tone=primary]:text-accent"
					{...readDataUiFn({
						dataUi: "StatusIcon",
						state: {
							spin: iconSpin,
							tone: iconTone,
						},
					})}
				/>
				<div className="grid gap-1.5">
					<h2 className="text-base font-semibold text-foreground group-data-[ui-size=large]/status:text-xl">
						{title}
					</h2>
					{description === undefined ? null : (
						<div className="text-sm text-muted group-data-[ui-size=large]/status:text-base">
							{description}
						</div>
					)}
				</div>
				{action === undefined ? null : <div className="w-full min-w-0 pt-1">{action}</div>}
			</div>
		</section>
	);
};
