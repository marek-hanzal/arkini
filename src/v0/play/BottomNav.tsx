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

const toneClassName: Record<Sheet, string> = {
	dev: "border-fuchsia-200 bg-fuchsia-50/60 text-ak-text-muted hover:border-fuchsia-300 hover:bg-fuchsia-50",
	inventory:
		"border-pink-200 bg-pink-50/70 text-ak-text-muted hover:border-fuchsia-300 hover:bg-fuchsia-50",
	upgrades:
		"border-violet-200 bg-violet-50/60 text-ak-text-muted hover:border-violet-300 hover:bg-violet-50",
	item: "border-pink-200 bg-white text-ak-text-muted hover:border-fuchsia-300 hover:bg-fuchsia-50",
};

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
				"flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm border text-[clamp(0.62rem,2.6vw,0.75rem)] font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px",
				toneClassName[tone],
				active && "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900",
			)}
			onClick={() => onOpen(tone)}
		>
			<span
				className="text-[clamp(1.15rem,4.4vw,1.45rem)] leading-none"
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
		className="absolute inset-x-0 bottom-0 h-[var(--ak-bottom-nav-height)] border-t border-pink-200 bg-white px-[max(0.65rem,env(safe-area-inset-left))] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
		style={{
			zIndex: "var(--ak-layer-bottom-nav)",
		}}
	>
		<div className="mx-auto grid h-full w-full max-w-[min(100%,520px)] grid-cols-3 gap-2">
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
