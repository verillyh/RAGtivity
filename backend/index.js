import { createApp } from "./app.js";
import { connectMongo } from "./config/mongo.js";
import { createMongoDBSearchIndex } from "./services/searchIndex.js";

const PORT = 4000;

async function main() {
  try {
    //Connect to MongoDB first
    await connectMongo();

    //Create search index after connection is ready
    await createMongoDBSearchIndex();

    //Initialize Express app
    const app = await createApp();

    //Start server
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Error starting server:", err);
  }
}

main();