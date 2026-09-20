import { Effect } from "effect";
import { Container, Sprite, Texture } from "pixi.js";

import type { ActorPose } from "~/game-scene/type/ActorPose";

export namespace readVisibleArtworkOccupantsFx {
	export interface Props {
		readonly pose: ActorPose;
		readonly layers: ReadonlyArray<Container>;
		readonly exclude: Container;
	}
}

/** Reads physical artwork, including exiting actors and identity-free travelling payloads. */
export const readVisibleArtworkOccupantsFx = Effect.fn("readVisibleArtworkOccupantsFx")(
	({ pose, layers, exclude }: readVisibleArtworkOccupantsFx.Props) =>
		Effect.sync((): ReadonlyArray<Container> => {
			const origin = pose.layer.toGlobal({
				x: pose.x,
				y: pose.y,
			});
			const opposite = pose.layer.toGlobal({
				x: pose.x + pose.size,
				y: pose.y + pose.size,
			});
			const left = Math.min(origin.x, opposite.x);
			const right = Math.max(origin.x, opposite.x);
			const top = Math.min(origin.y, opposite.y);
			const bottom = Math.max(origin.y, opposite.y);
			const occupants = new Set<Container>();
			for (const layer of new Set(layers)) {
				let visible = true;
				for (
					let ancestor: Container | null = layer;
					ancestor !== null;
					ancestor = ancestor.parent
				) {
					if (
						ancestor.destroyed ||
						!ancestor.visible ||
						!ancestor.renderable ||
						ancestor.alpha <= 0
					) {
						visible = false;
						break;
					}
				}
				if (!visible) continue;
				for (const root of layer.children) {
					const pending: Container[] = [
						root,
					];
					while (pending.length > 0) {
						const node = pending.pop();
						if (
							node === undefined ||
							node === exclude ||
							node.destroyed ||
							!node.visible ||
							!node.renderable ||
							node.alpha <= 0
						)
							continue;
						if (
							node instanceof Sprite &&
							node.texture !== Texture.EMPTY &&
							!node.texture.destroyed
						) {
							const bounds = node.getBounds();
							if (
								bounds.maxX > bounds.minX &&
								bounds.maxY > bounds.minY &&
								bounds.maxX > left &&
								bounds.minX < right &&
								bounds.maxY > top &&
								bounds.minY < bottom
							) {
								occupants.add(root);
								break;
							}
						}
						pending.push(...node.children);
					}
				}
			}
			return [
				...occupants,
			];
		}),
);
