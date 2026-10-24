import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, contentType, size } = req.body || {};
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(contentType)) {
      return res.status(400).json({ error: "Upload a JPG, PNG, or WebP image." });
    }
    if (!Number.isFinite(size) || size <= 0 || size > 8 * 1024 * 1024) {
      return res.status(400).json({ error: "Receipt must be 8 MB or smaller." });
    }

    const extFromType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[contentType];

    const safeOriginal = String(fileName || "receipt")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 70);
    const path = `receipts/${crypto.randomUUID()}-${safeOriginal || "receipt"}.${extFromType}`;

    const { data, error } = await supabase.storage
      .from("payment-receipts")
      .createSignedUploadUrl(path, { upsert: false });

    if (error) throw error;
    return res.status(200).json({ path: data.path, token: data.token });
  } catch (error) {
    console.error("Create upload URL failed:", error.message);
    return res.status(500).json({ error: "Could not prepare receipt upload. Check server configuration." });
  }
}
