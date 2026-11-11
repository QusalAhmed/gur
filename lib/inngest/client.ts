import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "gur-ecommerce",
  isDev: process.env.INNGEST_DEV === "1",
});
