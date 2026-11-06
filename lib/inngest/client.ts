import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "gur-ecommerce",
  isDev: process.env.NODE_ENV === "development" || process.env.INNGEST_DEV === "1",
});
