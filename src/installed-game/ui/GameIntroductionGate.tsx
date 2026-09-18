import { ArrowRight } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useGameIntroductionController } from "~/installed-game/ui/useGameIntroductionController";
import { PrimaryButton } from "~/ui/ui/Button";
import { Markdown } from "~/ui/ui/Markdown";
import { Overlay } from "~/ui/ui/Overlay";
import { Tx } from "~/translation/ui/Tx";

interface GameIntroductionGateProps
	extends useGameIntroductionController.Props,
		PropsWithChildren {}

/** Keeps the playable scene unmounted until the author welcome has been acknowledged. */
export const GameIntroductionGate = ({ game, children }: GameIntroductionGateProps) => {
	const { content, pending, continueFn } = useGameIntroductionController({
		game,
	});
	if (content === undefined) return children;
	return (
		<Overlay onCloseFn={() => undefined}>
			<section
				className="flex h-[75vh] w-[75vw] min-h-0 flex-col gap-6 rounded-lg border border-line bg-canvas p-6 shadow-2xl"
				data-ui="GameIntroduction"
			>
				<div className="min-h-0 flex-1 overflow-y-auto pr-3">
					<Markdown>{content}</Markdown>
				</div>
				<footer className="flex shrink-0 justify-end border-t border-line pt-4">
					<PrimaryButton
						className="gap-2"
						disabled={pending}
						onClick={continueFn}
					>
						<Tx label="Continue" />
						<ArrowRight className="size-5" />
					</PrimaryButton>
				</footer>
			</section>
		</Overlay>
	);
};
