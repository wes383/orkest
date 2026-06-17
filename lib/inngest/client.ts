import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "orkest",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
