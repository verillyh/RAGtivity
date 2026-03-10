import express from "express";
import bcrypt from "bcrypt";
import { mongoClient, dbName } from "../config/mongo.js";

const router = express.Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const usersCollection = mongoClient.db(dbName).collection("users");

  const queryIfUserExists = { email: email };
  try {
    const user = await usersCollection.findOne(queryIfUserExists);
    if (user != null) {
      return res.status(409).json({ message: "Users already exists. " });
    }
  } catch (err) {
    return res.status(500).json({
      message:
        "Something went wrong while querying if user already exists or not. Error message: " +
        err,
    });
  }

  const hashed_password = await bcrypt.hash(password, 10);

  const queryInsertUser = {
    email: email,
    hashed_password: hashed_password,
  };
  try {
    const insertUserResult = await usersCollection.insertOne(queryInsertUser);
    if (insertUserResult.acknowledged == false) {
      return res.status(500).json({
        message:
          "Write operation to the database not confirmed while inserting new user",
      });
    }
  } catch (err) {
    return res.status(500).json({
      message:
        "Something went wrong while inserting user to database. Error message: " +
        err,
    });
  }

  return res.json({ message: "User inserted successfully!" });
});

// Login endpoint
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  let userId;

  const usersCollection = mongoClient.db(dbName).collection("users");

  const queryUser = { email: email };
  const queryUserProjection = { email: 1, hashed_password: 1 };
  let userDetails;
  try {
    userDetails = await usersCollection.findOne(queryUser, queryUserProjection);
    if (userDetails == null) {
      return res.status(401).json({ message: "User doesn't exist" });
    }
    userId = userDetails._id;
  } catch (err) {
    return res.status(500).json({
      message:
        "Something went wrong while querying if user's details. Error message: " +
        err,
    });
  }

  const passwordIsCorrect = await bcrypt.compare(
    password,
    userDetails.hashed_password
  );

  if (!passwordIsCorrect) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  res.cookie("userId", userId);

  return res.json({ message: "Login successful" });
});

export default router;