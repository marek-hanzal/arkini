import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useFloating,
	useHover,
	useInteractions,
} from "@floating-ui/react";
import { useEffect, useMemo } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useTileCapabilities } from "~/bridge/tile/useTileCapabilities";
import { TileHoverActionBar } from "~/ui/tile/TileHoverActionBar";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import { useTileHoverSystem } from "~/ui/tile/useTileHoverSystem";
import { useTileWorkspaceControl } from "~/ui/tile-workspace/useTileWorkspaceControl";

const ActionBarMainAxisOffset = -8;
const ActionBarOpenDelayMs = 250;
const ActionBarCloseDelayMs = 150;

const actionDefinitions = [
	{
		capability: "info",
		label: "Info",
	},
	{
		capability: "status",
		label: "Status",
	},
	{
		capability: "lines",
		label: "Lines",
	},
	{
		capability: "effects",
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
	const game = useGameEngine();
	const capabilities = useTileCapabilities(itemId);
	const { isOpen: workspaceOpen, openEffects, openInfo, openStatus } = useTileWorkspaceControl();
	const { active } = useTileActorSystem();
	const { open, claimHover, releaseHover } = useTileHoverSystem(itemId);
	const availableActionDefinitions = useMemo(
		() => actionDefinitions.filter((action) => capabilities.includes(action.capability)),
		[
			capabilities,
		],
	);
	const suppressed =
		!live ||
		workspaceOpen ||
		availableActionDefinitions.length === 0 ||
		interactionSuppressesHover(active);
	const floating = useFloating({
		open,
		onOpenChange: (nextOpen) => {
			if (suppressed && nextOpen) return;
			if (nextOpen) claimHover();
			else releaseHover();
		},
		placement: "bottom",
		strategy: "fixed",
		middleware: [
			offset(ActionBarMainAxisOffset),
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
	const actions = useMemo(() => {
		const resources = game.config.resources.tileCapabilities;
		if (resources === undefined) return [];
		return availableActionDefinitions.map((action) => ({
			...action,
			iconUrl: game.getResourceUrl(resources[action.capability]),
			onSelect: () => {
				const reference = floating.refs.domReference.current;
				const origin =
					reference instanceof HTMLElement
						? reference.closest<HTMLElement>('[data-ui="TileActor"]')
						: null;
				releaseHover();
				match(action.capability)
					.with("info", () => openInfo(itemId, origin))
					.with("status", () => openStatus(itemId, origin))
					.with("effects", () => openEffects(itemId, origin))
					.with("lines", () => false)
					.exhaustive();
			},
		}));
	}, [
		availableActionDefinitions,
		floating.refs.domReference,
		game,
		itemId,
		releaseHover,
		openEffects,
		openInfo,
		openStatus,
	]);
	const hover = useHover(floating.context, {
		enabled: !suppressed,
		delay: {
			open: ActionBarOpenDelayMs,
			close: ActionBarCloseDelayMs,
		},
	});
	const interactions = useInteractions([
		hover,
	]);

	useEffect(() => {
		onHoverChange(open && !suppressed);
	}, [
		onHoverChange,
		open,
		suppressed,
	]);

	useEffect(() => {
		if (!suppressed || !open) return;
		releaseHover();
	}, [
		open,
		releaseHover,
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
						openDelayMs={ActionBarOpenDelayMs}
						mainAxisOffset={ActionBarMainAxisOffset}
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
