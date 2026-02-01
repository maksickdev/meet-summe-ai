use base64::{engine::general_purpose::STANDARD, Engine as _};
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
    previous_summary: Option<&str>,
) -> Result<String, String> {
    // Gemini Generative Language API: send audio as inlineData.
    let audio_b64 = STANDARD.encode(audio_bytes);

    let final_prompt = if let Some(prev) = previous_summary {
        format!(
            "Below is the current summary of the previous parts of the meeting:\n\n---\n{}\n---\n\nUsing the instructions from the original prompt below, update and supplement this summary based on the new audio part provided.\n\nOriginal Prompt:\n{}",
            prev, prompt_text
        )
    } else {
        prompt_text.to_string()
    };

    let body = json!({
      "contents": [
        {
          "role": "user",
          "parts": [
            {"text": &final_prompt},
            {"text": "\n\nNow process the provided audio and return the updated Markdown note. Return ONLY the Markdown without any extra text."},
            {"inlineData": {"mimeType": audio_mime, "data": audio_b64}}
          ]
        }
      ],
      "generationConfig": {
        "temperature": 0.2,
        "maxOutputTokens": 4096
      }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read Gemini response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Gemini API error ({status}): {raw}"));
    }

    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid Gemini JSON response: {e}"))?;

    let text = v
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("content"))
        .and_then(|ct| ct.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p0| p0.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| "Gemini response missing candidates[0].content.parts[0].text".to_string())?;

    Ok(text.trim().to_string())
}
