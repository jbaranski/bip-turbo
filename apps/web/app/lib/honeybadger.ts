import Honeybadger from "@honeybadger-io/js";
import { env } from "~/server/env";

export const honeybadger = Honeybadger.configure({
  apiKey: env.HONEYBADGER_API_KEY,
  environment: process.env.NODE_ENV || "development",
  reportData: true,
});

export default honeybadger;
