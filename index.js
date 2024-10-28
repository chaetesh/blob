const express = require("express");
const multer = require("multer");
const cors = require("cors");
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  BlobSASPermissions,
} = require("@azure/storage-blob");
require("dotenv").config();

const app = express();
app.use(cors());
const upload = multer(); // Using multer for file handling

// Azure Blob Storage Setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_BLOB_CONTAINER_NAME
);

// File Upload Endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).send("No file uploaded.");
    }

    // Set the blob name and content type
    const blobName = Date.now() + "-" + file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Determine the content type
    const contentType = file.mimetype || "application/octet-stream";

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + 60 * 1000); // Expires in 1 minute

    // Upload file to Azure Blob Storage with content type and metadata
    await blockBlobClient.upload(file.buffer, file.size, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: {
        expiryTime: expiryTime.toISOString(), // Store expiry time in ISO format
      },
    });
    console.log(`File ${blobName} uploaded successfully.`);

    // Retrieve blob properties, including metadata
    const blobProperties = await blockBlobClient.getProperties();

    // Generate SAS (Shared Access Signature) token for view-only access
    const sasToken = generateSASToken(blobName);
    const viewUrl = `${blockBlobClient.url}?${sasToken}`;

    return res.status(200).json({
      message: "File uploaded successfully.",
      viewUrl: viewUrl,
      metadata: blobProperties.metadata, // Include metadata in the response
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).send("Error uploading file.");
  }
});

// Generate SAS Token for View-Only Access
const generateSASToken = (blobName) => {
  const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_KEY
  );

  const sasOptions = {
    containerName: process.env.AZURE_BLOB_CONTAINER_NAME,
    blobName: blobName,
    permissions: BlobSASPermissions.parse("r"), // Read-only permission
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 60 * 1000), // Expires in 1 minute
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();
  return sasToken;
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
