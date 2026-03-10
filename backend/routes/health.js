import express from "express";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3client, S3_BUCKET_NAME } from "../config/s3.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const bucket = {
    Bucket: S3_BUCKET_NAME,
  };
  const headBucketCommand = new HeadBucketCommand(bucket);
  const response = await s3client.send(headBucketCommand);

  if (response.$metadata.httpStatusCode == 200) {
    return res.send("Bucket exists!");
  } else {
    return res
      .status(500)
      .send("S3 bucket does not exist! Contact developers");
  }
});

export default router;