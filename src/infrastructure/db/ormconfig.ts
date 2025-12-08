import { DataSource } from "typeorm";
import { ChatInteraction } from "./entities/ChatInteraction.entity.js";
import { config } from "../config/env.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.CHATBOT_DB_URL,
  synchronize: true,         
  logging: false,
  entities: [ChatInteraction],
});