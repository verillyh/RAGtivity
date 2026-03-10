import express from "express";
import { mongoClient, dbName } from "../config/mongo.js";

const router = express.Router();

// DEV ONLY: List all users (do not use in production)
router.get("/users", async (req, res) => {
  const usersCollection = mongoClient.db(dbName).collection("users");

  let allUsers;
  try {
    allUsers = await usersCollection.find().toArray();
  } catch (err) {
    return res.status(500).json({
      message:
        "Something went wrong while fetching all users. Error message: " + err,
    });
  }

  return res.json(allUsers);
});

export default router;