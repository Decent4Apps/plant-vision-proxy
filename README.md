# Plant Vision Proxy (OpenAI primary, Gemini fallback)

POST /api/vision
Body:
{
  "image": "data:image/jpeg;base64,...." | "https://...",
  "question": "optional task",
  "detail": "auto|low|high",
  "expectJson": true,
  "secret": "PROXY_SECRET"
}

Response:
{
  "provider": "openai|gemini",
  "model": "...",
  "text": "raw model text",
  "data": { ...parsed JSON if any... }
}
