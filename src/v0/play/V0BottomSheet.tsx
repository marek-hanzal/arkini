import { motion } from "motion/react";
import type { FC, ReactNode } from "react";
import { cn } from "~/shared/cn";

const sheetDurationSeconds = 0.28;
const openEase = [
	0.22,
	1,
	0.36,
	1,
] as const;
const closeEase = [
	0.65,
	0,
	0.35,
	1,
] as const;

export namespace V0BottomSheet {
	export interface Props {
		open: boolean;
		children: ReactNode;
		className?: string;
		onClose(): void;
	}
}

export const V0BottomSheet: FC<V0BottomSheet.Props> = ({ open, children, className, onClose }) => (
	<div
		className="ak-bottom-sheet"
		data-open={open ? "true" : "false"}
	>
		<motion.button
			type="button"
			tabIndex={open ? 0 : -1}
			className="ak-bottom-sheet-backdrop"
			initial={false}
			animate={{
				opacity: open ? 1 : 0,
			}}
			transition={{
				duration: sheetDurationSeconds,
				ease: open ? openEase : closeEase,
			}}
			onClick={onClose}
		/>

		<motion.section
			className={cn("ak-bottom-sheet-panel", className)}
			initial={false}
			animate={{
				opacity: open ? 1 : 0,
				y: open ? 0 : "calc(100% + 16px)",
			}}
			transition={{
				duration: sheetDurationSeconds,
				ease: open ? openEase : closeEase,
			}}
		>
			<div className="ak-bottom-sheet-content">{children}</div>
		</motion.section>
	</div>
);
