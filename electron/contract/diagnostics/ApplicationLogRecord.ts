import { z } from "zod";

export const APPLICATION_LOG_BODY_MAX_LENGTH = 64 * 1_024;

export const ApplicationLogRecordSchema = z
	.object({
		level: z.enum([
			"debug",
			"info",
			"warning",
			"error",
			"fatal",
		]),
		message: z
			.string()
			.min(1)
			.max(160)
			.refine((message) => !/[\r\n]/u.test(message), {
				message: "Application log messages must fit on one line.",
			}),
		body: z.string().max(APPLICATION_LOG_BODY_MAX_LENGTH),
	})
	.strict();

export type ApplicationLogRecordSchema = typeof ApplicationLogRecordSchema;

export namespace ApplicationLogRecordSchema {
	export type Type = z.infer<ApplicationLogRecordSchema>;
}
