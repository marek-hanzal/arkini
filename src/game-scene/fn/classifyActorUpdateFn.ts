import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { isSameTileActorLocationFn } from "~/tile-rendering/fn/isSameTileActorLocationFn";
import { readCrowdAlphaFn } from "~/tile-rendering/fn/readCrowdAlphaFn";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorPose } from "~/game-scene/type/ActorPose";

interface ClassifyActorUpdateProps {
	readonly actor: PixiTileActor;
	readonly deliveryRetained: boolean;
	readonly directLanding: boolean;
	readonly displayItem: TileActorItem;
	readonly motionClaimed: boolean;
	readonly pose: ActorPose;
	readonly poseChannelActive: boolean;
	readonly preserveVisual: boolean;
}

interface ActorUpdatePlan {
	readonly activityEffect: "start" | "stop" | null;
	readonly crowdAlpha: number | null;
	readonly item:
		| {
				readonly kind: "assign";
		  }
		| {
				readonly kind: "progress";
		  }
		| {
				readonly kind: "visual";
				readonly preserveVisual: boolean;
				readonly size: number;
		  };
	readonly pose:
		| {
				readonly kind: "owned";
		  }
		| {
				readonly kind: "place";
		  }
		| {
				readonly directLanding: boolean;
				readonly kind: "travel";
				readonly scaleBeforeTravel: number | null;
		  };
}

const isSameMainSceneVisualFn = (left: TileActorItem, right: TileActorItem) => {
	if (left.revision !== right.revision) return false;
	if (left.primaryAction.kind !== right.primaryAction.kind) return false;
	if (
		left.primaryAction.kind === "enqueue-default-line" &&
		(right.primaryAction.kind !== "enqueue-default-line" ||
			left.primaryAction.lineId !== right.primaryAction.lineId ||
			left.primaryAction.queue.available !== right.primaryAction.queue.available ||
			left.primaryAction.queue.capacity !== right.primaryAction.queue.capacity ||
			left.primaryAction.queue.used !== right.primaryAction.queue.used)
	)
		return false;
	return (
		left.activityEffect === right.activityEffect &&
		left.badgeCount === right.badgeCount &&
		left.badgeKind === right.badgeKind &&
		left.compositeUrl === right.compositeUrl &&
		left.quantity === right.quantity &&
		left.running === right.running &&
		left.sourceUrl === right.sourceUrl &&
		left.title === right.title
	);
};

export const classifyActorUpdateFn = ({
	actor,
	deliveryRetained,
	directLanding,
	displayItem,
	motionClaimed,
	pose,
	poseChannelActive,
	preserveVisual,
}: ClassifyActorUpdateProps): ActorUpdatePlan => {
	const moved = !isSameTileActorLocationFn(actor.item.location, displayItem.location);
	const visualChanged = !isSameMainSceneVisualFn(actor.currentVisual.item, displayItem);
	const progressChanged = actor.item.progressRatio !== displayItem.progressRatio;
	const sizeChanged = actor.size !== pose.size;
	const poseOwned = actor.dragging || deliveryRetained || motionClaimed || poseChannelActive;
	const nextCrowdAlpha = readCrowdAlphaFn(displayItem);
	const crowdAlpha = readCrowdAlphaFn(actor.item) === nextCrowdAlpha ? null : nextCrowdAlpha;
	const activityEffect =
		actor.item.activityEffect === displayItem.activityEffect
			? null
			: displayItem.activityEffect
				? "start"
				: "stop";
	const previousDisplayedSize = actor.size * actor.container.scale.x;
	const item: ActorUpdatePlan["item"] =
		visualChanged || sizeChanged
			? {
					kind: "visual",
					preserveVisual,
					size: poseOwned ? actor.size : pose.size,
				}
			: progressChanged
				? {
						kind: "progress",
					}
				: {
						kind: "assign",
					};
	if (poseOwned) {
		return {
			activityEffect,
			crowdAlpha,
			item,
			pose: {
				kind: "owned",
			},
		};
	}
	const needsTravel =
		moved || actor.container.x !== pose.x || actor.container.y !== pose.y || sizeChanged;
	return {
		activityEffect,
		crowdAlpha,
		item,
		pose: needsTravel
			? {
					directLanding,
					kind: "travel",
					scaleBeforeTravel: sizeChanged
						? previousDisplayedSize / Math.max(1, pose.size)
						: null,
				}
			: {
					kind: "place",
				},
	};
};
