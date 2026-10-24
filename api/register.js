
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      fullName,
      email,
      phone,
      telegram,
      university,
      course,
      receiptPath
    } = req.body || {};

    if (
      !fullName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !university?.trim() ||
      !course?.trim() ||
      !receiptPath
    ) {
      return res.status(400).json({
        error: "Please complete all required fields and upload your receipt."
      });
    }

    if (
      typeof receiptPath !== "string" ||
      !receiptPath.startsWith("receipts/") ||
      receiptPath.includes("..")
    ) {
      return res.status(400).json({
        error: "Invalid receipt reference."
      });
    }

    const { data: receipt, error: downloadError } =
      await supabase.storage
        .from("payment-receipts")
        .download(receiptPath);

    if (downloadError || !receipt) {
      return res.status(400).json({
        error: "Receipt upload could not be verified. Please upload it again."
      });
    }

    if (receipt.size > 8 * 1024 * 1024) {
      return res.status(400).json({
        error: "Receipt must be 8 MB or smaller."
      });
    }

    const { data: saved, error: insertError } =
      await supabase
        .from("registrations")
        .insert({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          telegram_username: telegram?.trim() || null,
          university: university.trim(),
          course: course.trim(),
          receipt_path: receiptPath,
          status: "pending"
        })
        .select("id")
        .single();

    if (insertError) throw insertError;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Telegram environment variables are missing.");
      return res.status(200).json({
        success: true,
        message: "Registration saved. Admin notification is not configured."
      });
    }

    const caption = [
      "🆕 Brainful Hub registration",
      `ID: ${saved.id}`,
      `Name: ${fullName.trim()}`,
      `Email: ${email.trim()}`,
      `Phone: +251${phone.trim()}`,
      `Telegram: ${telegram?.trim() || "Not provided"}`,
      `University: ${university.trim()}`,
      `Course: ${course.trim()}`,
      "Payment: Pending verification"
    ].join("\n");

    const telegramForm = new FormData();
    telegramForm.append("chat_id", chatId);
    telegramForm.append("caption", caption.slice(0, 1024));
    telegramForm.append("photo", receipt, "receipt.jpg");

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: "POST",
        body: telegramForm
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram sendPhoto failed:", result.description);
      return res.status(200).json({
        success: true,
        message: "Registration saved, but the Telegram notification failed. Contact the admin."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Registration submitted successfully. Payment is pending verification."
    });

  } catch (error) {
    console.error("Registration failed:", error.message);
    return res.status(500).json({
      error: "Could not submit registration. Please try again later."
    });
  }
}
