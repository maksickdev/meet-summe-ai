// use base64::{engine::general_purpose::STANDARD, Engine as _}; // Removed unused
use serde_json::json;

pub fn template_text(template_id: &str) -> Result<&'static str, String> {
    match template_id {
        "meeting_notes" => Ok(include_str!(
            "../../../../../packages/prompts/meeting_notes.txt"
        )),
        "lecture_notes" => Ok(include_str!(
            "../../../../../packages/prompts/lecture_notes.txt"
        )),
        "brainstorming" => Ok(include_str!(
            "../../../../../packages/prompts/brainstorming.txt"
        )),
        "interview" => Ok(include_str!(
            "../../../../../packages/prompts/interview.txt"
        )),
        _ => Err(format!("Unknown template_id: {template_id}")),
    }
}

pub fn guess_audio_mime_type(path: &std::path::Path) -> String {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "flac" => "audio/flac",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub async fn summarize_audio_to_markdown(
    api_key: &str,
    audio_bytes: Vec<u8>,
    audio_mime: &str,
    prompt_text: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // 1. Upload file using Gemini File API
    println!("[AI] Uploading audio to File API ({} bytes)...", audio_bytes.len());
    
    let upload_url = format!(
        "https://generativelanguage.googleapis.com/upload/v1beta/files?key={}",
        api_key
    );

    let metadata = json!({
        "file": {
            "display_name": "meeting_part",
            "mime_type": audio_mime,
        }
    });

    let resp = client
        .post(&upload_url)
        .header("X-Goog-Upload-Protocol", "multipart")
        .header("X-Goog-Upload-Command", "upload, finalize")
        .header("X-Goog-Upload-Header-Content-Length", audio_bytes.len().to_string())
        .header("X-Goog-Upload-Header-Content-Type", audio_mime)
        .multipart(reqwest::multipart::Form::new()
            .part("metadata", reqwest::multipart::Part::text(metadata.to_string()).mime_str("application/json").unwrap())
            .part("file", reqwest::multipart::Part::bytes(audio_bytes).mime_str(audio_mime).unwrap())
        )
        .send()
        .await
        .map_err(|e| format!("Failed to upload audio to Gemini File API: {e}"))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini File API upload error: {}", err_text));
    }

    let upload_res: serde_json::Value = resp.json().await.map_err(|e| format!("Invalid upload response: {e}"))?;
    let file_uri = upload_res["file"]["uri"].as_str().ok_or("Missing file URI")?.to_string();
    let file_name = upload_res["file"]["name"].as_str().ok_or("Missing file name")?.to_string();

    // 2. Poll for file status 
    println!("[AI] Waiting for file to be processed (id: {})...", file_name);
    let get_file_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}?key={}",
        file_name, api_key
    );

    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts > 30 {
            return Err("Timeout waiting for audio file processing".to_string());
        }

        let poll_resp = client.get(&get_file_url).send().await.map_err(|e| format!("Poll failed: {e}"))?;
        let poll_json: serde_json::Value = poll_resp.json().await.map_err(|e| format!("Invalid poll JSON: {e}"))?;
        
        let state = poll_json["state"].as_str().unwrap_or("PROCESSING");
        if state == "ACTIVE" {
            break;
        } else if state == "FAILED" {
            return Err("Gemini reported file processing failure".to_string());
        }

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }

    // 3. Generate content
    let generate_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let body = json!({
      "contents": [
        {
          "role": "user",
          "parts": [
            {"text": prompt_text},
            {"text": "\n\nProcess the audio and return the Markdown note. Return ONLY Markdown content. Ensure the response is complete and not truncated."},
            {"fileData": {"mimeType": audio_mime, "fileUri": file_uri}}
          ]
        }
      ],
      "generationConfig": {
        "temperature": 0.1,
        "topP": 0.95
      }
    });

    let resp = client
        .post(&generate_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini generateContent request failed: {e}"))?;

    let raw = resp.text().await.map_err(|e| format!("Failed to read generateContent response: {e}"))?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| format!("Invalid generateContent JSON: {e}"))?;

    let candidate = v.get("candidates")
        .and_then(|c| c.get(0))
        .ok_or_else(|| format!("Gemini response missing candidates. Full response: {}", raw))?;

    let finish_reason = candidate.get("finishReason").and_then(|f| f.as_str()).unwrap_or("UNKNOWN");
    if finish_reason == "MAX_TOKENS" {
        println!("[AI] WARNING: Response was truncated due to MAX_TOKENS limit (8192).");
    }

    let text = candidate
        .get("content")
        .and_then(|ct| ct.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p0| p0.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| format!("Gemini response missing text. Reason: {}. Response: {}", finish_reason, raw))?;

    let trimmed = text.trim();
    println!("[AI] Received response ({} characters, finish_reason: {})", trimmed.len(), finish_reason);

    Ok(trimmed.to_string())
}
