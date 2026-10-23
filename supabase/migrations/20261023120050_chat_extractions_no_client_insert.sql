-- Chat document extractions are written only by the server (the insights chat's
-- extract_health_document tool, with the service role). The INSERT policy let a
-- signed-in user create a row directly through the API with any storage_path
-- and any extraction JSON, which "Log it" (persistChatDocument) then saved as a
-- health record. Without the policy only the service role can insert.
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS "Users insert own chat extractions" ON public.chat_document_extractions;
