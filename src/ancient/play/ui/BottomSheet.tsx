import { type FC, type ReactNode } from "react";
import { motion } from "motion/react";
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

export namespace BottomSheet {
	export interface Props {
		/**
		 * The sheet stays mounted; Motion owns the visual open/close state so the
		 * active sheet content does not remount mid-gesture.
		 */
		open: boolean;
		children: ReactNode;
		className?: string;
		containerClassName?: string;
		contentClassName?: string;
		"data-drag-node-id"?: string;
		onClose(): void;
	}
}

export const BottomSheet: FC<BottomSheet.Props> = ({
	open,
	children,
	className,
	containerClassName,
	contentClassName,
	onClose,
	"data-drag-node-id": dragNodeId,
}) => {
	return (
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
				data-drag-node-id={dragNodeId}
				className={cn("ak-bottom-sheet-panel", className, containerClassName)}
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
				<div className={cn("ak-bottom-sheet-content", contentClassName)}>{children}</div>
			</motion.section>
		</div>
	);
};
