import { supabase } from "../lib/supabase.js";

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      fullName, email, phone, telegram, university, course, receiptPath
    } = req.body || {};

    if (!fullName?.trim() || !email?.trim() || !phone?.trim() ||
        !university?.trim() || !course?.trim() || !receiptPath) {
      return res.status(400).json({ error: "Please complete all required fields and upload your receipt." });
    }

    if (typeof receiptPath !== "string" ||
        !receiptPath.startsWith("receipts/") ||
        receiptPath.includes("..")) {
      return res.status(400).json({ error: "Invalid receipt reference." });
    }

    const { data: receipt, error: downloadError } = await supabase.storage
      .from("payment-receipts")
      .download(receiptPath);

    if (downloadError || !receipt) {
      return res.status(400).json({ error: "Receipt upload could not be verified. Please upload it again." });
    }
    if (receipt.size > MAX_BYTES) {
      return res.status(400).json({ error: "Receipt must be 8 MB or smaller." });
    }

    const { data: saved, error: insertError } = await supabase
      .from("registrations")
      .insert({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        telegram_username: (telegram || "").trim() || null,
        university: university.trim(),
        course: course.trim(),
        receipt_path: receiptPath,
        status: "pending"
      })
      .select("id, created_at")
      .single();

    if (insertError) throw insertError;

    let telegramSent = false;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (botToken && chatId) {
      const caption = [
        "🆕 Brainful Hub course registration",
        `Registration ID: ${saved.id}`,
        `Name: ${fullName.trim()}`,
        `Email: ${email.trim()}`,
        `Phone: +251${phone.trim()}`,
        `Telegram: ${(telegram || "").trim() || "Not provided"}`,
        `University: ${university.trim()}`,
        `Course: ${course.trim()}`,
        "Payment status: Pending verification"
      ].join("\n");

      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption.slice(0, 1024));
      form.append("photo", receipt, "payment-receipt");

      const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        body: form
      });
      const tgResult = await tgResponse.json().catch(() => ({}));
      telegramSent = tgResponse.ok && tgResult.ok === true;

      if (!telegramSent) {
        console.error("Telegram notification failed:", tgResult.description || tgResponse.status);
      }
    } else {
      console.error("Telegram environment variables are missing.");
    }

    return res.status(200).json({
      success: true,
      registrationId: saved.id,
      telegramSent,
      message: telegramSent
        ? "Registration submitted successfully. Your payment is pending verification."
        : "Registration saved, but the admin notification could not be sent. Please contact Brainful Hub."
    });
  } catch (error) {
    console.error("Registration failed:", error.message);
    return res.status(500).json({ error: "Could not submit registration. Please try again later." });
  }
}
