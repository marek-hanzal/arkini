import { CircleHelp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { LinkButton } from "~/ui/ui/LinkButton";
import { useOverlayFocus } from "~/ui/ui/useOverlayFocus";

export interface EditorPageHelpContent {
	readonly content: ReactNode;
	readonly title: string;
}

const EditorPageHelpTransition = {
	duration: 0.18,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const EditorPageHelpDialog = ({
	content,
	title,
	onCloseFn,
}: EditorPageHelpContent & {
	readonly onCloseFn: () => void;
}) => {
	const focus = useOverlayFocus({
		onCloseFn,
	});
	return (
		<motion.div
			animate={{
				opacity: 1,
			}}
			className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]"
			data-ui="EditorPageHelpBackdrop"
			exit={{
				opacity: 0,
			}}
			initial={{
				opacity: 0,
			}}
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) onCloseFn();
			}}
			transition={EditorPageHelpTransition}
		>
			<motion.div
				ref={focus.overlayRef}
				animate={{
					opacity: 1,
				}}
				className="w-full max-w-lg rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorPageHelpDialog"
				exit={{
					opacity: 0,
				}}
				initial={{
					opacity: 0,
				}}
				onKeyDown={focus.onKeyDownFn}
				transition={EditorPageHelpTransition}
			>
				<div className="flex items-center gap-3">
					<CircleHelp className="size-6 shrink-0 text-accent" />
					<h2 className="text-lg font-semibold">{title}</h2>
					<LinkButton
						className="ml-auto inline-flex size-8 shrink-0 items-center justify-center no-underline"
						data-ui="EditorPageHelpClose"
						onClick={onCloseFn}
						title="Close"
					>
						<X className="size-5" />
					</LinkButton>
				</div>
				<div className="mt-4 grid gap-3 text-sm leading-6 text-muted">{content}</div>
			</motion.div>
		</motion.div>
	);
};

/** Presents optional page-owned guidance from the shared editor header. */
export const EditorPageHelp = ({ content, title }: EditorPageHelpContent) => {
	const [open, setOpenFn] = useState(false);
	return (
		<>
			<LinkButton
				className="inline-flex size-9 items-center justify-center text-foreground no-underline hover:text-accent"
				data-ui="EditorPageHelpOpen"
				title="Page help"
				onClick={() => setOpenFn(true)}
			>
				<CircleHelp className="size-5" />
			</LinkButton>
			{createPortal(
				<AnimatePresence>
					{open ? (
						<EditorPageHelpDialog
							content={content}
							key="page-help"
							title={title}
							onCloseFn={() => setOpenFn(false)}
						/>
					) : null}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
};
