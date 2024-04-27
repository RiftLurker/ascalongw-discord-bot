import { getUnixTime } from "date-fns";

export function getDiscordTimestamp(date : Date, format: "F" | "f" | "D" | "d" | "t" | "T" | "R" = "f") {
    return `<t:${getUnixTime(date)}:${format}>`;
}