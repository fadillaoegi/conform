// The page object: Waypoint Desk's partners. The page and the site action read the same data.
import { PARTNERS } from "./desk-data.js";

export class Desk {
  static state() {
    return {
      desk: "Waypoint Desk",
      policy: "Every partner's agent is checked with Conform before any hand-off, and the visitor approves each contact on a card.",
      partners: PARTNERS.map((p) => ({ ...p })),
    };
  }

  static render() {
    const list = document.querySelector("#partner-list");
    if (!list) return;
    list.replaceChildren(...PARTNERS.map((p) => {
      const li = document.createElement("li");
      li.className = "partner";
      const h = document.createElement("h3");
      h.textContent = p.name;
      const offers = document.createElement("p");
      offers.textContent = p.offers;
      const agent = document.createElement("p");
      agent.append("Agent: ");
      const code = document.createElement("code");
      code.textContent = p.networkUrl;
      agent.append(code);
      const link = document.createElement("a");
      link.href = p.page;
      link.textContent = "Visit their site";
      li.append(h, offers, agent, link);
      return li;
    }));
  }
}

if (typeof document !== "undefined") Desk.render();
