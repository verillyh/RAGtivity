import { MongoClient } from "mongodb";
import { getMongoUri } from "./env.js";

const URI = getMongoUri();
export const dbName = "ragtivity";
export const mongoClient = new MongoClient(URI);

export async function connectMongo() {
  if (!mongoClient.isConnected?.()) { // Node Mongo v5+
    await mongoClient.connect();
    console.log("Connected to MongoDB");
  }
}