import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";

/** Template-qualified authored recipe identity, never a shared runtime room identity. */
export const readGraphSpaceDestinationIdFn = (space: SpaceDestinationSchema.Type): string =>
	typeof space === "object" ? `space:inventory:${space.templateUid}` : `space:${space}`;
