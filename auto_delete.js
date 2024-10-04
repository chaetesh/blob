const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

// Azure Blob Storage Setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_BLOB_CONTAINER_NAME
);

// Function to check and delete expired files
const deleteExpiredFiles = async () => {
  try {
    console.log("Checking for expired files...");

    // Get the list of blobs in the container
    for await (const blob of containerClient.listBlobsFlat()) {
      const blobClient = containerClient.getBlobClient(blob.name);
      const properties = await blobClient.getProperties();

      // Check if metadata has the 'expirytime' field
      const expiryTime = properties.metadata && properties.metadata.expirytime;
      if (expiryTime) {
        const expiryDate = new Date(expiryTime);
        const currentDate = new Date();

        // If the current time is past the expiry time, delete the blob
        if (currentDate > expiryDate) {
          console.log(`File ${blob.name} has expired. Deleting...`);
          await blobClient.delete();
          console.log(`File ${blob.name} deleted successfully.`);
        } else {
          console.log(`File ${blob.name} has not expired yet.`);
        }
      } else {
        console.log(`File ${blob.name} does not have an expiry time.`);
      }
    }
  } catch (error) {
    console.error("Error checking for expired files:", error.message);
  }
};

// Set an interval to run this function every 30 seconds
setInterval(deleteExpiredFiles, 30000);

console.log("Auto-delete script is running...");
