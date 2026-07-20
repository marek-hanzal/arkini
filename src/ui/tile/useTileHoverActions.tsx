import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	safePolygon,
	shift,
	useFloating,
	useHover,
	useInteractions,
} from "@floating-ui/react";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

import { TileHoverActionBar } from "~/ui/tile/TileHoverActionBar";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

const actions = [
	{
		capability: "info",
		icon: "ℹ️",
		label: "Info",
	},
	{
		capability: "status",
		icon: "📊",
		label: "Status",
	},
	{
		capability: "lines",
		icon: "⚙️",
		label: "Lines",
	},
	{
		capability: "effects",
		icon: "✨",
		label: "Effects",
	},
] as const;

const interactionSuppressesHover = (active: TileInteractionState | null) =>
	match(active)
		.with(null, () => false)
		.with(
			{
				phase: "pressed",
			},
			{
				phase: "dragging",
			},
			{
				phase: "awaiting-outcome",
			},
			() => true,
		)
		.with(
			{
				phase: "settling",
			},
			() => false,
		)
		.exhaustive();

/** Owns one actor-anchored Floating UI hover strip and its DnD suppression boundary. */
export const useTileHoverActions = ({
	itemId,
	live,
	onHoverChange,
}: {
	readonly itemId: string;
	readonly live: boolean;
	readonly onHoverChange: (hovered: boolean) => void;
}) => {
	const { active } = useTileActorSystem();
	const suppressed = !live || interactionSuppressesHover(active);
	const [open, setOpen] = useState(false);
	const floating = useFloating({
		open,
		onOpenChange: (nextOpen) => {
			if (suppressed && nextOpen) return;
			setOpen(nextOpen);
			onHoverChange(nextOpen);
		},
		placement: "bottom",
		strategy: "fixed",
		middleware: [
			offset(8),
			flip(),
			shift({
				padding: 8,
			}),
		],
		whileElementsMounted: (reference, floatingElement, update) =>
			autoUpdate(reference, floatingElement, update, {
				animationFrame: true,
			}),
	});
	const hover = useHover(floating.context, {
		enabled: !suppressed,
		handleClose: safePolygon({
			buffer: 1,
		}),
	});
	const interactions = useInteractions([
		hover,
	]);

	useEffect(() => {
		if (!suppressed || !open) return;
		setOpen(false);
		onHoverChange(false);
	}, [
		onHoverChange,
		open,
		suppressed,
	]);

	return {
		setReference: floating.refs.setReference,
		getReferenceProps: interactions.getReferenceProps,
		actionBar:
			open && !suppressed ? (
				<FloatingPortal>
					<TileHoverActionBar
						actions={actions}
						placement={floating.placement}
						referenceId={itemId}
						style={floating.floatingStyles}
						setFloating={floating.refs.setFloating}
						getFloatingProps={interactions.getFloatingProps}
					/>
				</FloatingPortal>
			) : null,
	};
};
