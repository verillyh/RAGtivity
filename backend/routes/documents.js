import express from "express";
import { Blob } from "buffer";
import {
  PutObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mongoClient, dbName } from "../config/mongo.js";
import { s3client, S3_BUCKET_NAME } from "../config/s3.js";

const router = express.Router();


//*********************************************************************************************************************************************************
// Get all user's document
router.get("/documents", async (req, res) => {
  const userEmail = req.query.email;

  const usersCollection = mongoClient.db(dbName).collection("users");

  const queryUserDocuments = { email: userEmail };
  const queryOptions = { projection: { documents: 1, _id: 0 } };
  let userDocuments;
  try {
    userDocuments = await usersCollection.findOne(
      queryUserDocuments,
      queryOptions
    );

    if (Object.keys(userDocuments).length === 0) {
      return res.json({
        documents: [],
      });
    }
  } catch (err) {
    return res.status(500).json({
      message:
        "Something went wrong while querying user's documents. Error message: " +
        err,
    });
  }

  return res.json({ documents: userDocuments.documents });
});

//*********************************************************************************************************************************************************
// Upload documents
router.post("/documents", async (req, res) => {
  const userEmail = req.body.email;
  let files = req.files.files;

  let chunk_and_embeddings;
  let uploadFileInput;
  let uploadFileCommand;
  let uploadFileResponse;

  if (Array.isArray(files) == false) {
    files = [files];
  }

  const usersCollection = mongoClient.db(dbName).collection("users");
  const chunkedCollection = mongoClient.db(dbName).collection("chunked_documents");
  const queryGetUser = { email: userEmail };
  let filesToInsert = [];
  let userId;

  try {
    let userDocuments = await usersCollection.findOne(queryGetUser, {
      projection: { documents: 1 },
    });
    userId = userDocuments._id;
    userDocuments = userDocuments.documents;
    for (const uploadedFile of files) {
      for (const recordedFile of userDocuments) {
        if (uploadedFile.name == recordedFile.filename) {
          throw new Error("Duplicated file(s)", { cause: "Duplicate" });
        }
      }
    }
  } catch (e) {
    if (e.cause == "Duplicate") {
      return res.status(400).json({
        reason: "FILENAME_EXISTS",
        message:
          "One or more file was found to have the same name as a previously uploaded one(s)",
      });
    }
  }

  try {
    const blobFile = new Blob([files[0].data], { type: "application/pdf" });
    let formData = new FormData();
    formData.append("file", blobFile, files[0].name);
    const response = await fetch("http://rag:8000/upload", {
      method: "POST",
      body: formData,
    });

    chunk_and_embeddings = await response.json();
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send(
        "Something went wrong while trying to get the file chunked and get its embeddings"
      );
  }

  const mongoChunkedDocumentsToInsert = [];
  for (let i = 0; i < chunk_and_embeddings.text.length; i++) {
    mongoChunkedDocumentsToInsert.push({
      userId: userId,
      filename: files[0].name,
      chunk_num: i,
      text: chunk_and_embeddings.text[i],
      embeddings: chunk_and_embeddings.embeddings[i],
    });
  }

  for (const file of files) {
    let uploadFilename = `${userEmail}/${file.name}`;

    uploadFileInput = {
      Body: file.data,
      Bucket: S3_BUCKET_NAME,
      Key: uploadFilename,
    };
    uploadFileCommand = new PutObjectCommand(uploadFileInput);
    uploadFileResponse = await s3client.send(uploadFileCommand);

    if (uploadFileResponse.$metadata.httpStatusCode != 200) {
      if (filesToInsert.length != 0) {
        let deleteObjectsInput = {
          Bucket: S3_BUCKET_NAME,
          Delete: {
            Objects: filesToInsert.map((item) => ({ Key: item.name })),
          },
        };
        const deleteObjectsCommand = new DeleteObjectsCommand(
          deleteObjectsInput
        );
        await s3client.send(deleteObjectsCommand);
      }

      return res.status(500).json({
        message: "Something went wrong while uploading file to S3 storage",
        AWS_code: uploadFileResponse.$metadata.httpStatusCode,
      });
    }

    filesToInsert.push({
      filename: file.name,
      uploadedFilename: uploadFilename,
    });
  }

  const queryAddFiles = {
    $push: {
      documents: { $each: filesToInsert },
    },
  };

  const mongoSession = mongoClient.startSession();
  try {
    mongoSession.startTransaction();
    await usersCollection.updateOne(queryGetUser, queryAddFiles, {
      mongoSession,
    });
    await chunkedCollection.insertMany(mongoChunkedDocumentsToInsert, {
      mongoSession,
    });
    mongoSession.commitTransaction();
  } catch (err) {
    mongoSession.abortTransaction();
    return res
      .status(500)
      .send(
        "Something went wrong while adding document to database. Error message: ",
        err
      );
  } finally {
    mongoSession.endSession();
  }

  return res.send("Documents uploaded successfully");
});

//*********************************************************************************************************************************************************
router.post("/delete_document", async (req, res) => {
  const { email, filename } = req.body;

  const usersCollection = mongoClient.db(dbName).collection("users");
  const chunkedCollection = mongoClient
    .db(dbName)
    .collection("chunked_documents");

  let userId;

  const queryIdentifyUser = { email: email };
  const queryDeleteFile = { $pull: { documents: { filename: filename } } };
  const queryDocumentStoragePath = {
    projection: {
      documents: {
        $elemMatch: { filename: filename },
      },
    },
  };

  let documentStoragePath;
  try {
    documentStoragePath = await usersCollection.findOne(
      queryIdentifyUser,
      queryDocumentStoragePath
    );
    userId = documentStoragePath._id;
    documentStoragePath = documentStoragePath.documents[0].uploadedFilename;
  } catch (err) {
    return res.status(500).send(
      "Something went wrong while querying if document exists or not. Error message: " +
        err
    );
  }

  const deleteObjectInput = {
    Bucket: S3_BUCKET_NAME,
    Key: documentStoragePath,
  };
  const deleteObjectCommand = new DeleteObjectCommand(deleteObjectInput);
  const deleteObjectResponse = await s3client.send(deleteObjectCommand);

  if (deleteObjectResponse.$metadata.httpStatusCode != 204) {
    return res
      .status(500)
      .send("Something went wrong while deleting object from S3 bucket");
  }

  const queryDeleteChunkedDocuments = {
    userId: userId,
    filename: filename,
  };

  const mongoSession = mongoClient.startSession();
  try {
    mongoSession.startTransaction();
    await usersCollection.updateOne(queryIdentifyUser, queryDeleteFile, {
      mongoSession,
    });
    await chunkedCollection.deleteMany(queryDeleteChunkedDocuments, {
      mongoSession,
    });
    mongoSession.commitTransaction();
  } catch (err) {
    mongoSession.abortTransaction();
    return res.status(500).send(
      "Something went wrong while deleting file records from MongoDB. Error message: " +
        err
    );
  } finally {
    mongoSession.endSession();
  }

  return res.status(200).send("Document successfully deleted");
});

export default router;