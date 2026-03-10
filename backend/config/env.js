import dotenv from "dotenv";

dotenv.config();

export const getMongoUri = () => process.env.MONGO_URI;
export const getFrontendUrl = () =>
  process.env.FRONTEND_URL || "http://localhost:5173";