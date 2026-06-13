import { DateServiceLive } from "~/date/logic/DateServiceLive";
import { createIdService } from "~/id/logic/createIdService";

export const IdServiceLive = createIdService(DateServiceLive);
