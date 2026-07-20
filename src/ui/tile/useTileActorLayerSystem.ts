import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes only the actor-layer anchor registration and active presentation generation. */
export const useTileActorLayerSystem = () => {
	const { active, registerActorLayer } = useTileSystemContext();
	return {
		active,
		registerActorLayer,
	};
};
