from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import storage
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow your Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Google Cloud Storage client
PROJECT_ID = os.getenv('PROJECT_ID')
storage_client = storage.Client(project=PROJECT_ID)

# Get bucket name from environment variable
BUCKET_NAME = os.getenv('BUCKET_NAME')

@app.get("/api/assessment/{service_name}")
async def get_assessment(service_name: str):
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        
        current_blob_path = f"{service_name}/current.md"
        updated_blob_path = f"{service_name}/updated.md"
        changes_blob_path = f"{service_name}/changes.json"
        
        current_blob = bucket.blob(current_blob_path)
        current_content = current_blob.download_as_text()
        
        updated_blob = bucket.blob(updated_blob_path)
        if updated_blob.exists():
            updated_content = updated_blob.download_as_text()
            changes_blob = bucket.blob(changes_blob_path)
            if changes_blob.exists():
                changes_content = changes_blob.download_as_text()
                changes = json.loads(changes_content)
            else:
                changes = []
        else:
            updated_content = None
            changes = []
        
        return {
            "current_assessment": current_content,
            "updated_assessment": updated_content,
            "changes": changes
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=404, detail=f"Error retrieving assessment: {str(e)}")

@app.get("/api/metadata/{service_name}")
async def get_metadata(service_name: str):
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        metadata_blob_path = f"{service_name}/metadata.json"
        metadata_blob = bucket.blob(metadata_blob_path)
        
        if metadata_blob.exists():
            metadata_content = metadata_blob.download_as_text()
            metadata = json.loads(metadata_content)
            return metadata
        else:
            raise HTTPException(status_code=404, detail="Metadata not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving metadata: {str(e)}")

@app.post("/api/accept_change/{service_name}")
async def accept_change(service_name: str, change: dict = Body(...)):
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        
        current_blob_path = f"{service_name}/current.md"
        updated_blob_path = f"{service_name}/updated.md"
        
        current_blob = bucket.blob(current_blob_path)
        updated_blob = bucket.blob(updated_blob_path)
        
        current_content = current_blob.download_as_text().splitlines()
        updated_content = updated_blob.download_as_text().splitlines()
        
        current_start_line = change['currentStartLine']
        current_end_line = change['currentEndLine']
        updated_start_line = change['updatedStartLine']
        updated_end_line = change['updatedEndLine']
        
        # Replace the content in current file with content from updated file
        current_content[current_start_line:current_end_line] = updated_content[updated_start_line:updated_end_line]
        
        # Update the current blob
        current_blob.upload_from_string("\n".join(current_content))
        
        # Check if there are any remaining differences
        if current_content == updated_content:
            # If no differences remain, delete the updated blob
            updated_blob.delete()
        
        return {"message": "Change accepted and files updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accepting change: {str(e)}")

@app.post("/api/reject_change/{service_name}")
async def reject_change(service_name: str, change: dict = Body(...)):
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        
        current_blob_path = f"{service_name}/current.md"
        updated_blob_path = f"{service_name}/updated.md"
        
        current_blob = bucket.blob(current_blob_path)
        updated_blob = bucket.blob(updated_blob_path)
        
        current_content = current_blob.download_as_text().splitlines()
        updated_content = updated_blob.download_as_text().splitlines()
        
        current_start_line = change['currentStartLine']
        current_end_line = change['currentEndLine']
        updated_start_line = change['updatedStartLine']
        updated_end_line = change['updatedEndLine']
        
        # Replace the content in updated file with content from current file
        updated_content[updated_start_line:updated_end_line] = current_content[current_start_line:current_end_line]
        
        # Update the updated blob
        updated_blob.upload_from_string("\n".join(updated_content))
        
        return {"message": "Change rejected and files updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rejecting change: {str(e)}")

@app.post("/api/accept_block_change/{service_name}")
async def accept_block_change(service_name: str, block: list = Body(...)):
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        
        current_blob_path = f"{service_name}/current.md"
        updated_blob_path = f"{service_name}/updated.md"
        
        current_blob = bucket.blob(current_blob_path)
        updated_blob = bucket.blob(updated_blob_path)
        
        current_content = current_blob.download_as_text().splitlines()
        updated_content = updated_blob.download_as_text().splitlines()
        
        # Get the overall start and end lines for the block
        block_start = min(change['currentStartLine'] for change in block)
        block_end = max(change['currentEndLine'] for change in block)
        updated_start = min(change['updatedStartLine'] for change in block)
        updated_end = max(change['updatedEndLine'] for change in block)
        
        # Replace the content in current file with content from updated file for this block
        current_content[block_start:block_end] = updated_content[updated_start:updated_end]
        
        # Update the current blob
        current_blob.upload_from_string("\n".join(current_content))
        
        # Check if there are any remaining differences
        if current_content == updated_content:
            # If no differences remain, delete the updated blob
            updated_blob.delete()
        
        return {"message": "Block change accepted and files updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accepting block change: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)