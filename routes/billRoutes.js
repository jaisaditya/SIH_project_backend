// backend/routes/billRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Bill from "../models/Bill.js";
import Medicine from "../models/Medicine.js";
import { protectPharmacy } from "../middleware/pharmacyAuthMiddleware.js";
import { createWorker } from "tesseract.js";
import OpenAI from "openai";

const router = express.Router();

// ---------------- Multer storage ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ---------------- Tesseract worker (singleton) ----------------
let ocrWorker = null;
async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = createWorker();
    await ocrWorker.load();
    await ocrWorker.loadLanguage("eng");
    await ocrWorker.initialize("eng");
  }
  return ocrWorker;
}

async function extractTextFromImage(filePath) {
  const worker = await getOcrWorker();
  const {
    data: { text },
  } = await worker.recognize(filePath);
  return text;
}

// ---------------- Pharmacy Detection ----------------
async function detectPharmacyNameWithOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are given raw OCR text from a pharmacy bill. 
Identify the pharmacy/shop name that issued the bill. 
Return ONLY the name as plain text, no explanation, no JSON. 
If unclear, return "Unknown".

OCR TEXT:
---
${text}
---`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0,
    });

    const output = resp.choices[0]?.message?.content?.trim();
    if (!output || output.toLowerCase() === "unknown") return null;

    return output.toLowerCase();
  } catch (err) {
    console.warn("OpenAI pharmacy detection failed:", err?.message || err);
    return null;
  }
}

function extractPharmacyNameFallback(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return lines.slice(0, 3).join(" ").toLowerCase();
}

async function detectPharmacyName(text) {
  let name = await detectPharmacyNameWithOpenAI(text);
  if (!name) {
    name = extractPharmacyNameFallback(text);
  }
  return name;
}

// ---------------- Name Normalization ----------------
function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces & punctuation
}

// ---------------- Fallback Parser ----------------
function fallbackParseMedicines(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  const medLineRegex =
    /([A-Za-z][A-Za-z0-9\-\s\/]*)\s*(?:\s(\d+\s*(mg|g|ml|tabs|tablets|tablet|pcs)?)\s*)?(?:x?\s*(\d+))?\s*(?:₹\s?(\d+(\.\d+)?))?/i;

  for (const line of lines) {
    const m = medLineRegex.exec(line);
    if (m) {
      const name = (m[1] || "").trim();
      if (!name) continue;
      const qty = m[4] ? parseInt(m[4]) : 0;
      const price = m[5] ? parseFloat(m[5]) : undefined;
      items.push({
        name,
        genericName: "",
        category: "Unknown",
        form: "",
        quantity: qty,
        price,
      });
    }
  }

  // dedupe
  const dedup = [];
  const seen = new Set();
  for (const it of items) {
    const n = it.name.toLowerCase();
    if (!seen.has(n)) {
      dedup.push(it);
      seen.add(n);
    }
  }
  return dedup;
}

// ---------------- OpenAI Parser ----------------
async function parseMedicinesWithOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are given raw OCR text extracted from a pharmacy bill.
Extract medicine items as a JSON array. Each item must have:
- name (string)
- genericName (string or empty)
- category (string, e.g., Painkillers, Antibiotics, or "Unknown")
- form (string like Tablet, Syrup or empty)
- quantity (integer or 0)
- price (number or null)
- expiryDate (YYYY-MM-DD or null)

Return only valid JSON (an array). Example:
[{"name":"Paracetamol","genericName":"Acetaminophen","category":"Painkillers","form":"Tablet","quantity":10,"price":20,"expiryDate":null}]

OCR TEXT:
---
${text}
---`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0,
    });

    let output = resp.choices[0]?.message?.content?.trim();
    if (!output) return null;

    const firstBracket = output.indexOf("[");
    const lastBracket = output.lastIndexOf("]");
    const jsonText =
      firstBracket !== -1 && lastBracket !== -1
        ? output.slice(firstBracket, lastBracket + 1)
        : output;

    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.warn("OpenAI parse failed:", err?.message || err);
    return null;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------- Upload Bill Route ----------------
router.post(
  "/upload-bill",
  protectPharmacy,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
      if (!req.pharmacy || !req.pharmacy._id)
        return res.status(401).json({ message: "Not authorized" });

      const filePath = path.join(process.cwd(), "uploads", req.file.filename);

      // OCR
      const text = await extractTextFromImage(filePath);

      // ✅ Detect pharmacy
      const detectedPharmacy = await detectPharmacyName(text);
      const detectedNorm = normalizeName(detectedPharmacy);
      const loggedInNorm = normalizeName(req.pharmacy.name);

      if (
        detectedNorm &&
        !(
          detectedNorm.includes(loggedInNorm) ||
          loggedInNorm.includes(detectedNorm)
        )
      ) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          message: "Bill does not belong to your pharmacy. Upload rejected.",
        });
      }

      // create bill entry
      let bill = await Bill.create({
        pharmacyId: req.pharmacy._id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        status: "Processing",
        medicines: [],
      });

      // parse medicines
      let parsed = null;
      if (process.env.OPENAI_API_KEY) {
        parsed = await parseMedicinesWithOpenAI(text);
      }
      if (!parsed) parsed = fallbackParseMedicines(text);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        bill.status = "Completed";
        await bill.save();

        const io = req.app.get("io");
        if (io) {
          io.emit("bill-processed", { bill, pharmacyId: req.pharmacy._id });
          io.emit("medicines-updated", { pharmacyId: req.pharmacy._id });
        }
        return res.status(200).json(bill);
      }

      const createdIds = [];
      for (const item of parsed) {
        const name = (item.name || "").trim();
        if (!name) continue;

        const existing = await Medicine.findOne({
          name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
          pharmacyId: req.pharmacy._id,
        });

        if (existing) {
          const update = {};
          if (typeof item.quantity === "number") update.quantity = item.quantity;
          if (typeof item.price === "number") update.price = item.price;
          if (item.expiryDate) update.expiryDate = new Date(item.expiryDate);
          update.updatedAt = new Date();
          const updated = await Medicine.findByIdAndUpdate(existing._id, update, {
            new: true,
          });
          createdIds.push(updated._id);
        } else {
          const med = await Medicine.create({
            name,
            genericName: item.genericName || "",
            category: item.category || "Unknown",
            form: item.form || "",
            quantity: typeof item.quantity === "number" ? item.quantity : 0,
            price: typeof item.price === "number" ? item.price : undefined,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
            pharmacy: req.pharmacy.name || "",
            pharmacyId: req.pharmacy._id,
            sourceBill: bill._id,
            location: req.pharmacy.address || "",
          });
          createdIds.push(med._id);
        }
      }

      bill.medicines = createdIds;
      bill.status = "Completed";
      await bill.save();

      const io = req.app.get("io");
      if (io) io.emit("bill-processed", { bill, pharmacyId: req.pharmacy._id });

      return res.status(201).json(bill);
    } catch (err) {
      console.error("bill upload error:", err);
      return res
        .status(500)
        .json({ message: "Bill processing failed", error: err.message });
    }
  }
);

// ---------------- Delete Bill Route ----------------
router.delete("/:id", protectPharmacy, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    if (bill.pharmacyId.toString() !== req.pharmacy._id.toString()) {
      return res.status(403).json({ message: "Not allowed to delete this bill" });
    }

    await Medicine.deleteMany({ sourceBill: bill._id });

    if (bill.fileName) {
      const filePath = path.join(process.cwd(), "uploads", bill.fileName);
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    await Bill.findByIdAndDelete(bill._id);

    const io = req.app.get("io");
    if (io) {
      io.emit("bill-deleted", { billId: bill._id, pharmacyId: bill.pharmacyId });
      io.emit("medicines-updated", { pharmacyId: bill.pharmacyId });
    }
    res.json({ message: "Bill and associated medicines deleted", id: bill._id });
  } catch (err) {
    console.error("delete bill error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---------------- Get Bills by Pharmacy ----------------
router.get("/pharmacy/:pharmacyId", async (req, res) => {
  try {
    const bills = await Bill.find({ pharmacyId: req.params.pharmacyId }).sort({
      createdAt: -1,
    });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Backward compatible
router.get("/:pharmacyId", async (req, res) => {
  try {
    const bills = await Bill.find({ pharmacyId: req.params.pharmacyId }).sort({
      createdAt: -1,
    });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;

