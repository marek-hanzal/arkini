import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileStackMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { restoreActorExitFx } from "~/tile-rendering/fx/restoreActorExitFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
import { createLiveContactPoseReaderFx } from "~/tile-motion/fx/createLiveContactPoseReaderFx";
import { flashMotionTargetFx } from "~/tile-motion/fx/flashMotionTargetFx";
import { projectMotionItemFn } from "~/tile-motion/fn/projectMotionItemFn";
import type { TargetRoute } from "~/tile-motion/type/MotionTarget";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export namespace runStackMotionFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileStackMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: MagneticField;
		readonly onCompleteFn: () => void;
		readonly onPayloadCreatedFn: (actor: PixiTileActor) => void;
		readonly origin: ActorPose;
		readonly readPaletteFn: () => PixiScenePalette;
		readonly readTargetRouteFn: (
			actorId: string,
			location: TargetRoute["location"],
		) => TargetRoute;
		readonly surface: MainSurface;
		readonly target: ActorPose;
		readonly textures: TextureStore;
	}
}

/** Animates a consumed source actor or an identity-free produced stack payload. */
export const runStackMotionFx = Effect.fn("runStackMotionFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onCompleteFn,
	onPayloadCreatedFn,
	origin,
	readPaletteFn,
	readTargetRouteFn,
	surface,
	target,
	textures,
}: runStackMotionFx.Props) {
	const readLiveContactPoseFn = yield* createLiveContactPoseReaderFx();
	const canonical =
		actorStore.canonicalItems.get(cue.targetActorId) ??
		actorStore.actors.get(cue.targetActorId)?.item;
	if (canonical === undefined) {
		onCompleteFn();
		return;
	}
	const candidateSource = actorStore.actors.get(cue.originActorId);
	const source =
		candidateSource?.item.itemId === cue.canonicalItemId &&
		!actorStore.canonicalItems.has(cue.originActorId)
			? candidateSource
			: null;
	const payload =
		source ??
		(yield* createTileActorFx({
			frames: application.frames,
			item: projectMotionItemFn(
				{
					...canonical,
					id: `motion:${cueKey}`,
				},
				{
					kind: "exact",
					quantity: cue.quantity,
				},
			),
			palette: readPaletteFn(),
			textures,
		}));
	if (source !== null) {
		yield* restoreActorExitFx({
			actor: source,
			animator,
		});
	}
	payload.container.eventMode = "none";
	if (source === null) onPayloadCreatedFn(payload);
	surface.transientActorLayer.addChild(payload.container);
	yield* updateTileActorFx({
		actor: payload,
		animator,
		frames: application.frames,
		item: payload.item,
		palette: readPaletteFn(),
		size: target.size,
		textures,
	});
	if (source === null) {
		yield* animator.setFx({
			actor: payload,
			channel: "pose",
			scale: origin.size / Math.max(1, payload.size),
			x: origin.x,
			y: origin.y,
		});
		yield* startActorEnterFx({
			actor: payload,
			animator,
			delayMs,
		});
	}
	const readCurrentRouteFn = () => readTargetRouteFn(cue.targetActorId, cue.targetLocation);
	const readLiveTargetFn = () => {
		const route = readCurrentRouteFn();
		return readLiveContactPoseFn({
			actorId: route.actorId,
			actors: actorStore.actors,
			movingActor: payload,
		});
	};
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: payload,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
		surface,
		readAttractionFn: () => {
			const route = readCurrentRouteFn();
			return {
				attractedActorId: route.actorId,
				eligibleAttractionActorIds: new Set([
					route.actorId,
				]),
			};
		},
	});
	yield* chaseTargetFx({
		actor: payload,
		animator,
		delayMs,
		fallbackTarget: target,
		onPoseFn: magneticProjector.projectPoseFn,
		onSettledFn: () => {
			const route = readCurrentRouteFn();
			RendererRuntime.runSync(
				flashMotionTargetFx({
					actorStore,
					animator,
					targetActorId: route.actorId,
				}),
			);
			let settled = false;
			const settleFn = () => {
				if (settled) return;
				settled = true;
				magneticProjector.releaseFn();
				RendererRuntime.runSync(animator.cancelActorFx(payload));
				RendererRuntime.runSync(destroyTileActorFx(payload));
				onCompleteFn();
			};
			RendererRuntime.runSync(
				startActorExitFx({
					actor: payload,
					animator,
					onCancelFn: settleFn,
					onCompleteFn: settleFn,
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTargetFn,
		surface,
		targetLocation: cue.targetLocation,
	});
});
