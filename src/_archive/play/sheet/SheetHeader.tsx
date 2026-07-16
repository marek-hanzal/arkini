import type { FC } from "react";

export namespace SheetHeader {
	export interface Props {
		title: string;
		onClose(): void;
	}
}

export const SheetHeader: FC<SheetHeader.Props> = ({ title, onClose }) => {
	return (
		<div
			data-ui="sheet header"
			className="border-b border-ak-border bg-[linear-gradient(135deg,rgba(255,240,251,0.96),rgba(248,229,255,0.98))]"
		>
			<div className="relative mx-auto flex w-full max-w-[540px] items-center justify-center px-4 py-4">
				<h2 className="min-w-0 max-w-[calc(100%-4rem)] text-center text-[1.05rem] font-black leading-tight text-ak-text">
					{title}
				</h2>
				<button
					type="button"
					aria-label="Close sheet"
					className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-sm border border-ak-border bg-white/70 text-[1.6rem] leading-none text-ak-text shadow-[0_8px_18px_rgba(168,85,247,0.12)] transition hover:border-ak-border-accent hover:bg-ak-primary-soft active:translate-y-[calc(-50%+1px)]"
					onClick={onClose}
				>
					✕
				</button>
			</div>
		</div>
	);
};
