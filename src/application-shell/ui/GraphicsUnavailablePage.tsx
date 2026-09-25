import { TriangleAlert } from "lucide-react";

import { Button } from "~/ui/ui/Button";
import { Canvas } from "~/ui/ui/Canvas";

interface GraphicsUnavailablePageProps {
	readonly onCloseFn: () => void;
}

/** Terminal startup surface when Pixi has no supported GPU renderer. */
export const GraphicsUnavailablePage = ({ onCloseFn }: GraphicsUnavailablePageProps) => (
	<Canvas>
		<main
			className="grid size-full place-items-center p-[var(--ak-viewport-padding)]"
			data-ui="GraphicsUnavailablePage"
		>
			<section
				className="grid w-full max-w-lg gap-4 rounded-2xl border border-danger/35 bg-surface p-[var(--ak-panel-padding)] text-center shadow-2xl"
				data-ui="GraphicsUnavailableAlert"
			>
				<TriangleAlert className="mx-auto size-10 text-danger" />
				<h1 className="text-xl font-semibold text-danger">Graphics unavailable</h1>
				<p className="text-sm text-foreground">
					Serakki requires WebGL or WebGPU to run. Neither is available on this computer
					right now.
				</p>
				<p className="text-sm text-muted">
					Enable hardware acceleration or update your graphics driver, then restart
					Serakki.
				</p>
				<Button
					className="mx-auto"
					onClick={onCloseFn}
				>
					Close Serakki
				</Button>
			</section>
		</main>
	</Canvas>
);
