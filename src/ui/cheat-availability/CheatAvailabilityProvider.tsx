import type { PropsWithChildren } from "react";
import type { CheatAvailability } from "~/bridge/cheat/CheatAvailability";
import { CheatAvailabilityContext } from "~/ui/cheat-availability/CheatAvailabilityContext";

/** Provides the renderer-wide application cheat-tool availability owner. */
export const CheatAvailabilityProvider = ({
	availability,
	children,
}: PropsWithChildren<{
	readonly availability: CheatAvailability;
}>) => <CheatAvailabilityContext value={availability}>{children}</CheatAvailabilityContext>;
