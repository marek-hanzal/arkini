import { z } from "zod";

export const CraftProgressPhaseSchema = z.enum([
	"collecting_inputs",
	"waiting",
	"paused",
	"delivery_blocked",
	"ready",
]);
