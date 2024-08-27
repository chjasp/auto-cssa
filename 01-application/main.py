import datetime
import json
import logging
import os
import requests

from pydantic_settings import BaseSettings
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import feedparser

from typing import Optional, List, Dict
from prompts import get_prompt

from google.cloud import firestore
from google.cloud import storage
import google.generativeai as genai
import difflib

# ---------- (1) Configuration ----------

load_dotenv()

class Settings(BaseSettings):
    """Application settings from environment variables."""
    gcp_project_id: str = os.getenv("PROJECT_ID")
    gcp_firestore_database: str = os.getenv("FIRESTORE_DB")
    gcp_firestore_collection: str = os.getenv("FIRESTORE_COLLECTION")
    gcp_gemini_model: str = os.getenv("GEMINI_MODEL")
    gcp_storage_bucket: str = os.getenv("BUCKET_NAME")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY")
    gcp_rss_feed: str = os.getenv("GCP_RSS_FEED")

settings = Settings()
logging.basicConfig(level=logging.INFO)

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel(settings.gcp_gemini_model)
storage_client = storage.Client(project=settings.gcp_project_id)
bucket = storage_client.bucket(settings.gcp_storage_bucket)
db = firestore.Client(project=settings.gcp_project_id,
                      database=settings.gcp_firestore_database)

# ---------- (2) Helper Functions ----------

def fetch_release_notes(rss_feed_url: str) -> List[Dict[str, str]]:
    logging.info(f"Fetching GCP release notes from {rss_feed_url}")

    feed = feedparser.parse(rss_feed_url)
    updates = []

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    min_date = now_utc - datetime.timedelta(days=3)

    for entry in feed.entries:
        updated_date = datetime.datetime.fromisoformat(entry.updated)
        if updated_date >= min_date:
            soup = BeautifulSoup(entry.content[0].value, 'html.parser')
            update = {
                'title': entry.title,
                'link': entry.link,
                'summary': entry.summary,
                'updated': updated_date.isoformat(),
                'content': soup.get_text()
            }
            updates.append(update)

    logging.info(f"Fetched {len(updates)} release notes.")
    return updates

def fetch_html_content(url: str) -> str:
    """Fetches and cleans the HTML content from the given URL."""
    response = requests.get(url)
    response.raise_for_status()  # Raise an exception for bad responses
    soup = BeautifulSoup(response.content, 'html.parser')
    return soup.get_text()

def identify_relevant_cssas(update: dict) -> List[str]:
    logging.info(f"Identifying relevant CSSAs for update: {update['title']}")

    cssa_refs = db.collection(settings.gcp_firestore_collection).stream()
    cssa_list = "\n".join(
        [f"- {cssa.to_dict()['service_name']}" for cssa in cssa_refs])

    prompt = get_prompt("identify_relevant_cssas",
                        update_title=update["title"], update_content=update["content"], cssa_list=cssa_list)
    response = model.generate_content(prompt)

    cssa_names = response.text.replace("\n", "").replace("Services:", "").strip()
    cssa_names = [name.strip() for name in cssa_names.split(",") if name.strip()]
    logging.info(f"{update['title']}:\n{cssa_names}")
    return cssa_names

def fetch_cssa_from_storage(cssa_name: str) -> Optional[str]:
    logging.info(f"Fetching CSSA from storage: {cssa_name}")

    blob_name = f"assessments/{cssa_name}.txt"
    blob = bucket.blob(blob_name)
    if blob.exists():
        return blob.download_as_text()
    else:
        logging.error(f"CSSA file not found: {blob_name}")
        return None

def analyze_with_llm(update: dict, cssa_content: str) -> str:
    logging.info(
        f"Analyzing update '{update['title']}'")

    prompt = get_prompt("analyze_update_impact", update_title=update["title"],
                        update_content=update["content"], cssa_content=cssa_content)

    response = model.generate_content(prompt)
    return response.text

def process_and_store_assessment(
    llm_suggestions: str, update: dict, cssa_name: str
) -> None:
    doc_ref = db.collection(settings.gcp_firestore_collection).document(cssa_name)
    doc_snapshot = doc_ref.get()
    logging.info(f"Storing assessment results for {cssa_name}")

    existing_suggestions = doc_snapshot.to_dict().get("suggested_update", "") if doc_snapshot.exists else ""

    if not llm_suggestions or llm_suggestions.lower() in ["none", "no changes needed"]:
        new_suggestions = f"**{update['updated']} - {update['title']}**\nNo changes needed.\n\n{existing_suggestions}"
        assessment_result = "compliant"
    else:
        new_suggestions = f"**{update['updated']} - {update['title']}**\n{llm_suggestions}\n\n{existing_suggestions}"
        assessment_result = "update_needed"

    doc_ref.set({
        "assessment_result": assessment_result,
        "last_update": datetime.datetime.now(),
        "service_name": cssa_name.replace(".txt", ""),
        "suggested_update": new_suggestions
    })

# ---------- (3) Main Function (CF entry point) ----------

def process_release_notes(request: Optional[Dict[str, str]] = None) -> str:
    """Processes either GCP release notes (RSS) or a custom HTML page."""

    source_type = request.get("source_type", "rss") if request else "rss"
    url = request.get("url", settings.gcp_rss_feed) if request else settings.gcp_rss_feed
    logging.info(f"Processing {source_type} from: {url}")

    updates = fetch_release_notes(url) if source_type == "rss" else [{
        'title': f'HTML update from {url}',
        'link': url,
        'summary': 'Custom HTML Update',
        'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'content': fetch_html_content(url)
    }]

    for update in updates:
        potentially_affected_cssas = identify_relevant_cssas(update)
        for cssa_name in potentially_affected_cssas:
            cssa_content = fetch_cssa_from_storage(cssa_name)
            if cssa_content:
                llm_suggestions = analyze_with_llm(update, cssa_content)
                process_and_store_assessment(llm_suggestions, update, cssa_name)
            else:
                logging.warning(f"Skipping analysis for {cssa_name} due to missing content")

        storage_client = storage.Client()
    db = firestore.Client()

    bucket = storage_client.bucket(BUCKET_NAME)
    collection_ref = db.collection(FIRESTORE_COLLECTION)

    for update in updates:
        # Generate a unique identifier for the update
        update_id = f"{update['title']}_{update['updated']}"
        
        # Check if we have a previous version
        previous_blob = bucket.get_blob(f"{update['title']}/previous.txt")
        
        if previous_blob:
            # Compute diff
            previous_content = previous_blob.download_as_text()
            diff = list(difflib.unified_diff(
                previous_content.splitlines(),
                update['content'].splitlines(),
                lineterm='',
                n=3  # context lines
            ))
            
            # Store diff in Firestore
            collection_ref.document(update_id).set({
                'title': update['title'],
                'last_update': update['updated'],
                'diff': diff,
                'status': 'pending'  # or 'new', to be reviewed
            })
        else:
            # If no previous version, store as new content
            collection_ref.document(update_id).set({
                'title': update['title'],
                'last_update': update['updated'],
                'content': update['content'],
                'status': 'new'
            })

        # Update the "previous" version in GCS
        new_blob = bucket.blob(f"{update['title']}/previous.txt")
        new_blob.upload_from_string(update['content'])

    return "Processing completed successfully", 200

# Call the main function with the test request
process_release_notes(test_request)
