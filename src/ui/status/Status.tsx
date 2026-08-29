import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export namespace Status {
	export interface Props {
		readonly action?: ReactNode;
		readonly dataUi?: string;
		readonly description: string;
		readonly icon: LucideIcon;
		readonly iconSpin?: boolean;
		readonly title: string;
		readonly variant?: "card" | "flat";
	}
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
}: Status.Props) => {
	const Icon = icon;
	return (
		<section
			className={`grid min-h-48 place-items-center p-[var(--ak-panel-padding)] text-center ${
				variant === "card" ? "rounded-2xl border border-line bg-surface/70" : ""
			}`}
			data-ui={dataUi}
		>
			<div className="grid max-w-md justify-items-center gap-3">
				<Icon
					className={`size-7 text-subtle${iconSpin ? " animate-spin" : ""}`}
					aria-hidden="true"
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
