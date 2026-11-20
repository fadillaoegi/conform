// Registers Waypoint Desk's one read action (agent-manifest.json -> actions.module).
import { Desk } from "./desk.js";

export const registerActions = (actions) => {
  actions.register({
    name: "get_desk_state",
    description: "Read Waypoint Desk's partners: for each, its name, what it offers, its agent network URL (to check with Conform and to call), and its page link. Also the desk's hand-off policy.",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => Desk.state(),
  });
};
