# AI image/data reading

Location: Market analysis → AI Analyze Candle → **អានរូបក្រាប និងរូបទិន្នន័យ**.

Choose a PNG/JPEG/WebP, review its preview, optionally enter a focus question and click **AI វិភាគរូបភាព**. The upload and question are sent to OpenAI only on that action. The application retains neither an image file nor a database record; browser object URLs are revoked when replaced/cleared/unmounted. The Responses request uses `store:false`; this does not claim to override the provider's own retention policies.

Configure `OPENAI_API_KEY` and a vision-capable `OPENAI_VISION_MODEL` on the server. The model falls back to `OPENAI_ANALYSIS_MODEL` when no vision override is set; that model must support both image input and structured outputs. Configuration presence is not a live verification of model entitlement. No live paid vision request was made because this installation does not have an AI key. Restart the dev server after configuration changes and reload the page.

The authenticated `/api/image-analysis` accepts bounded JSON data URLs only, not remote image URLs. Limits: 4 MB decoded file, 6 MB request, PNG/JPEG/WebP, 80–4096px per side, at most 16 megapixels, one non-animated image. Sharp 0.35.5 is an explicit dependency and fully decodes pixels to reject malformed uploads. Rate limit: four requests per member per minute. The route enforces the shared origin/auth checks and never logs uploads, questions, credentials or raw provider errors.

The vision prompt treats image text and user questions as untrusted evidence. It requests visible symbol/timeframe, copied labels/values/units, readability, historical visual trend, observations and limitations. Unknown readings remain null. Server output validation rejects malformed results and extra top-level fields. Unreadable results have their numeric readings/symbol/timeframe cleared and direction set to unclear. The report is always `basis: image-only`, `tradeAction: WAIT`, with no executable entry/SL/TP. No upload automatically modifies a candle-generated signal or trade. Screenshots cannot authenticate live prices, closed candles or a forecast probability.

References: https://developers.openai.com/api/docs/guides/images-vision and https://developers.openai.com/api/docs/guides/structured-outputs . Small text, rotation and non-Latin text are known limitations; the UI preserves uncertainty rather than claiming perfect OCR.

Validation: production build, lint (four existing image warnings) and 90 tests pass, including seven new tests for real raster validation, MIME/dimensions/size, remote/SVG/malformed rejection, strict vision payload/results, unreadable-image sanitization, approved auth/origin/rate/config gating and image-only/non-executable reports. Tests use synthetic image fixtures and mocked AI responses; neither live vision accuracy nor authenticated browser interaction is certified.
