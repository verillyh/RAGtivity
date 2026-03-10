import { mongoClient, dbName } from "../config/mongo.js";

export async function createMongoDBSearchIndex() {
  const existingIndexes = await mongoClient
    .db(dbName)
    .collection("chunked_documents")
    .listSearchIndexes()
    .toArray();
  const indexExists = existingIndexes.some(
    (index) => index.name == "vectorChunkIndex"
  );

  if (indexExists) {
    console.log("Index has already been created");
    return;
  }

  await mongoClient
    .db("ragtivity")
    .collection("chunked_documents")
    .createSearchIndex({
      name: "vectorChunkIndex",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            numDimensions: 768,
            path: "embeddings",
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "userId",
          },
          {
            type: "filter",
            path: "filename",
          },
        ],
      },
    });

  console.log("Vector search index created successfully");
}