import Honeybadger from "@honeybadger-io/js";
import { env } from "~/server/env";

// Server-side only Honeybadger configuration
export const honeybadger = Honeybadger.configure({
  apiKey: env.HONEYBADGER_API_KEY,
  environment: env.APP_ENV,
  reportData: true,
});

export default honeybadger;
