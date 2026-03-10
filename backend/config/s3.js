import { S3Client } from "@aws-sdk/client-s3";

export const S3_BUCKET_NAME = "ragtivity";

export const s3client = new S3Client({
  region: "ap-southeast-2",
});

