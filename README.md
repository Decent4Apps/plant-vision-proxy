# Plant Vision Proxy (OpenAI → Gemini fallback)

Serverless endpoint for image understanding. Primary: OpenAI (GPT-4o/mini). Fallback: Gemini (1.5-flash).

## Endpoint
POST `/api/vision`

### Body
```json
{
  "image": "data:image/jpeg;base64,..." | "https://...",
  "question": "Identify this plant. JSON keys: scientificName, commonName, description.",
  "detail": "auto|low|high",
  "expectJson": true,
  "secret": "PROXY_SECRET"
}
