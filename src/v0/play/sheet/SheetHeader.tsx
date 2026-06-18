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
			className="border-b border-violet-200 bg-white"
		>
			<div className="mx-auto flex w-full max-w-[430px] items-start justify-between gap-3 px-2 py-3">
				<h2 className="min-w-0 flex-1 text-[1.05rem] font-black leading-tight text-ak-text">
					{title}
				</h2>
				<button
					type="button"
					aria-label="Close sheet"
					className="grid h-9 w-9 shrink-0 place-items-center border border-violet-200 bg-white text-[1.75rem] leading-none text-ak-text transition hover:border-violet-300 hover:bg-violet-50 active:translate-y-px"
					onClick={onClose}
				>
					✕
				</button>
			</div>
		</div>
	);
};
