import { memo, type FC } from "react";
import type { Sheet } from "~/v0/play/sheet/Sheet";
import { cn } from "~/v0/ui/cn";

export namespace BottomNav {
	export interface Props {
		activeSheet?: Sheet;
		onOpen(sheet: Sheet): void;
	}
}

interface ButtonProps {
	active: boolean;
	label: string;
	icon: string;
	tone: Sheet;
	onOpen(sheet: Sheet): void;
}

const NavButton: FC<ButtonProps> = memo(({ active, label, icon, tone, onOpen }) => (
	<div
		data-ui="bottom nav slot"
		className="h-full w-full"
	>
		<button
			type="button"
			data-ui="bottom nav action"
			data-active={active ? "true" : "false"}
			data-tone={tone}
			aria-label={label}
			title={label}
			className={cn(
				"grid h-full w-full min-w-0 place-items-center rounded-sm border border-ak-border bg-ak-surface transition-[transform,border-color,background,color,opacity] active:translate-y-px",
				active
					? "border-ak-border-accent bg-ak-primary-soft text-ak-text"
					: "text-ak-text-muted hover:border-ak-border-accent hover:bg-ak-surface-soft",
			)}
			onClick={() => onOpen(tone)}
		>
			<span
				className="text-[clamp(1.35rem,6.8dvw,2.25rem)] leading-none"
				aria-hidden="true"
			>
				{icon}
			</span>
			<span className="absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
				{label}
			</span>
		</button>
	</div>
));

export const BottomNav: FC<BottomNav.Props> = memo(({ activeSheet, onOpen }) => (
	<nav
		data-ui="bottom nav"
		className="absolute inset-x-0 bottom-0 h-[var(--ak-bottom-nav-height)] bg-ak-page px-[max(clamp(0.5rem,2.5dvw,0.9rem),env(safe-area-inset-left))] pt-[clamp(0.35rem,1.6dvh,0.7rem)] pb-[calc(clamp(0.35rem,1.6dvh,0.65rem)+env(safe-area-inset-bottom))]"
		style={{
			zIndex: "var(--ak-layer-bottom-nav)",
		}}
	>
		<div className="mx-auto grid h-full w-full max-w-[min(100%,520px)] grid-cols-3 gap-[clamp(0.45rem,2dvw,0.8rem)]">
			<NavButton
				active={activeSheet === "inventory"}
				label="Inventory"
				icon="🎒"
				tone="inventory"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "upgrades"}
				label="Upgrades"
				icon="⏫"
				tone="upgrades"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "dev"}
				label="Dev"
				icon="🛠️"
				tone="dev"
				onOpen={onOpen}
			/>
		</div>
	</nav>
));
