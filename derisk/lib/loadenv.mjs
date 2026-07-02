// Load derisk/.env regardless of the current working directory.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../derisk/lib
dotenv.config({ path: path.join(here, "..", ".env") }); // .../derisk/.env
