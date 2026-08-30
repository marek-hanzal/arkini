import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";
import { EditorVersionRestoreCommandAtom } from "~/project-version/atom/EditorVersionRestoreCommandAtom";

const transition = {
	duration: 0.24,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

/** Renders the project restore Action above the replacement-bound editor subtree. */
export const EditorVersionRestoreAction = ({ projectId }: { readonly projectId: string }) => {
	const state = useAtomValue(EditorVersionRestoreCommandAtom(projectId));
	return createPortal(
		<AnimatePresence>
			{state.kind === "idle" ? null : (
				<motion.div
					className="fixed inset-0 z-[200] overflow-hidden bg-canvas"
					data-ui="EditorVersionRestoreAction"
					initial={{
						opacity: 0,
					}}
					animate={{
						opacity: 1,
					}}
					exit={{
						opacity: 0,
					}}
					transition={transition}
				>
					<ActionLoadingScreen
						completed={state.completed}
						durationMs={state.durationMs}
						label={`Restoring version “${state.subject}”…`}
					/>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
};
