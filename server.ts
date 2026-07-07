import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as chrono from "chrono-node";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const systemInstructionBase = `You are the ABC Hospital virtual assistant, a professional AI assistant for ABC Hospital, a prestigious hospital based in Ikeja, Lagos, Nigeria. 
Your primary responsibilities are assisting patients with appointment scheduling, providing basic medical information, and answering general questions about hospital services.

Tone & Persona:
- Professional, empathetic, and culturally aware of Nigerian context.
- Use polite and welcoming language (e.g., "Welcome to ABC Hospital", "How may I assist you today?").
- Clear and concise in your responses.
- The user may send you voice notes (audio messages), often spoken in Nigerian English or Pidgin. Transcribe or understand the audio appropriately and respond in clear, professional English.

Important Medical Disclaimer & Pricing Policy:
- Always clarify that you are an AI and cannot provide official medical diagnoses or prescribe medications. Advise patients to consult with a doctor for severe symptoms or emergencies.
- DO NOT quote any prices, consultation fees, registration costs, or estimated rates under any circumstances. If the user asks about prices, fees, or how much a service costs, explain clearly that only official hospital staff (front desk or billing department) can determine current prices and rates, and that you do not provide fee estimates.

Formatting & Highlighting:
- ALWAYS use Markdown to **highlight key information** for patients (e.g., **department names**, **important warnings**, **emergency instructions**, or **specific actions**).

Example Conversation 1:
Patient: I have a fever. Which department should I visit?
AI: A fever can have many causes. At our hospital, patients with a fever are usually assessed by the **General Medicine** department. **If your fever is very high, lasts several days, or is accompanied by difficulty breathing, severe chest pain, confusion, or seizures, seek emergency care immediately.** Would you like me to help you book an appointment?

Example Conversation 2:
Patient: Is Dr. John available tomorrow?
AI: Checks database:

SELECT *
FROM doctors
WHERE name='John'

Returns

Yes. Dr. John has available appointments tomorrow at 10:30 AM and 2:00 PM.

Appointment Scheduling:
When scheduling an appointment, gather the following details: Patient's name, Email address, Phone number, Department or Specialist needed, and Preferred date and time. Ensure you ask for their email and phone number if not yet provided. Once collected, confirm the details and inform them the appointment request has been logged.
If you are asking the patient to choose an appointment date, you must append the exact text \`[SHOW_CALENDAR]\` at the very end of your response. This will trigger a visual calendar for the user.
If an appointment has been successfully booked or confirmed, append the exact text \`[SHOW_CONFIRMATION|Doctor Name|Date|Time|Department|Patient Name|Email|Phone]\` at the very end of your response, replacing the placeholders with the actual details. This will trigger a visual confirmation card for the user. Example: \`[SHOW_CONFIRMATION|Dr. Babatunde Adeyemi|Monday, July 13, 2026|10:30 AM|Cardiology|Chinedu Obi|chinedu@example.com|+234 803 123 4567]\`

Closing of Conversation / Completion of Task:
Whenever a user's task is complete (e.g., they just successfully scheduled/confirmed an appointment, canceled/rescheduled, or their inquiry has been fully answered), you MUST explicitly ask them if they have any further inquiries or if they would like to be connected to speak with a human staff member.

Keep responses relatively brief and conversational.`;

const knowledgeBase = [
  { title: "Hospital Policies", content: "Registration requires a valid ID (NIN, Voters Card, or Driver's License). Full payment or valid HMO authorization is required before elective procedures." },
  { title: "Doctors", content: "Dr. Babatunde Adeyemi (Chief Medical Director, Cardiology)\nDr. Ngozi Okafor (Head of Pediatrics)\nDr. Ibrahim Musa (General Surgery)\nDr. Funmilayo Ojo (Obstetrics & Gynecology)" },
  { title: "Departments", content: "General Practice (OPD), Pediatrics, Cardiology, Surgery, Obstetrics & Gynecology (O&G), Pharmacy, Laboratory, Radiology." },
  { title: "Opening Hours", content: "The Emergency Room (ER) and Inpatient services are open 24/7. Outpatient clinics run from 8:00 AM to 5:00 PM, Monday to Saturday." },
  { title: "Medical Services", content: "Routine Checkups, Antenatal Care, Immunization, Minor & Major Surgeries, X-Ray & Ultrasound, Comprehensive Lab Tests, and Pharmacy." },
  { title: "Insurance Information (HMOs)", content: "We accept major Nigerian HMOs including Hygeia, Reliance HMO, AXA Mansard, Avon HMO, and Redcare. Please bring your HMO card and ensure your plan covers the specific service." },
  { title: "Prices & Consultation Fees", content: "Pricing, consultation fees, and procedural costs can only be determined directly by official ABC Hospital staff. Fee estimates or exact rates are not provided by this virtual assistant to prevent any billing discrepancy. Please check in with our front desk or finance department." },
  { title: "FAQs", content: "Do I need an appointment for general consultation? Walk-ins are accepted, but appointments are highly recommended to avoid long wait times.\nIs parking available? Yes, we have a secure car park for patients and visitors.\nDo you offer ambulance services? Yes, our emergency ambulance can be dispatched within Lagos." },
  { title: "Emergency Procedures", content: "For life-threatening emergencies, proceed immediately to the ER on the ground floor or call our emergency hotlines: 0800-ABC-HOSP (0800-874-6489) or 112." },
  { title: "Visitor Guidelines", content: "Visiting hours are 10:00 AM - 12:00 PM and 4:00 PM - 6:00 PM daily. A maximum of two visitors per patient is allowed at a time. Children under 12 are not allowed in the intensive care or maternity wards unless specially approved." }
];

let documentEmbeddings: { title: string; content: string; embedding: number[] }[] = [];

async function initializeKnowledgeBase() {
  console.log("Initializing knowledge base embeddings...");
  try {
    for (const doc of knowledgeBase) {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: `Title: ${doc.title}\n\n${doc.content}`,
      });
      documentEmbeddings.push({
        ...doc,
        embedding: response.embeddings?.[0]?.values || [],
      });
    }
    console.log("Knowledge base initialized with", documentEmbeddings.length, "documents.");
  } catch (error) {
    console.error("Failed to initialize embeddings:", error);
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function startServer() {
  await initializeKnowledgeBase();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, patientName, email, phone } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      // Filter out the initial welcome message if it's the first one to ensure
      // the history sent to the API strictly starts with a user message.
      let apiMessages = [...messages];
      if (apiMessages.length > 0 && apiMessages[0].role === 'model') {
        apiMessages = apiMessages.slice(1);
      }

      const history = apiMessages.map((msg: any) => {
        const parts: any[] = [];
        if (msg.audio) {
          parts.push({
            inlineData: {
              data: msg.audio,
              mimeType: msg.mimeType || "audio/webm",
            },
          });
        }
        if (msg.text) {
          parts.push({ text: msg.text });
        }
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts,
        };
      });

      // Inject current UI form values right into the latest user message to guarantee Gemini picks them up immediately.
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        const lastMsg = history[history.length - 1];
        let textPart = lastMsg.parts.find((p: any) => p.text !== undefined);
        const profileContext = `\n\n[Form Inputs Submitted: Patient Name: "${patientName || ''}", Email: "${email || ''}", Phone: "${phone || ''}". Use these details directly for any appointments or confirmations without asking the user again.]`;
        if (textPart) {
          textPart.text += profileContext;
        } else {
          lastMsg.parts.push({ text: profileContext });
        }
      }

      // Get latest user message for search
      const latestUserMsg = apiMessages.filter(m => m.role === 'user').pop();
      const currentDate = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
      let dynamicInstruction = systemInstructionBase + `\n\nCurrent Date and Time in Lagos, Nigeria: ${currentDate}`;
      
      // Inject Patient profile details if available to personalize and pre-fill booking
      dynamicInstruction += `\n\n=== PATIENT PROFILE INFO (FROM THE UI FORMS) ===`;
      dynamicInstruction += `\n- Patient's Full Name: ${patientName && patientName.trim() ? patientName.trim() : "Not provided in fields yet"}`;
      dynamicInstruction += `\n- Patient's Email: ${email && email.trim() ? email.trim() : "Not provided in fields yet"}`;
      dynamicInstruction += `\n- Patient's Phone Number: ${phone && phone.trim() ? phone.trim() : "Not provided in fields yet"}`;
      dynamicInstruction += `\n\nCRITICAL DIRECTIVES:`;
      dynamicInstruction += `\n1. If the user has entered their Name, Email, or Phone number in the fields above, do NOT ask them to provide these details again in the chat! Use them directly.`;
      dynamicInstruction += `\n2. If any of these fields are "Not provided in fields yet" and you need them to book an appointment, ask the user politely for them or remind them that they can fill them in the input boxes below the chat.`;
      dynamicInstruction += `\n3. When generating the confirmation token, you MUST replace the placeholders with the actual info: \`[SHOW_CONFIRMATION|Doctor Name|Date|Time|Department|Patient Name|Email|Phone]\`. For example, if Patient Name is "Chinedu Obi" and Doctor Name is "Dr. Babatunde Adeyemi", generate: \`[SHOW_CONFIRMATION|Dr. Babatunde Adeyemi|Monday, July 13, 2026|10:30 AM|Cardiology|Chinedu Obi|chinedu@example.com|+234 803 123 4567]\`.`;
      dynamicInstruction += `\n================================================`;

      if (latestUserMsg && latestUserMsg.text) {
        const parsedDates = chrono.parse(latestUserMsg.text, new Date());
        if (parsedDates.length > 0) {
          const dateContexts = parsedDates.map(p => `"${p.text}" refers to ${p.start.date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`);
          dynamicInstruction += `\n\nDate Parsing Context (for the user's latest message):\n${dateContexts.join('\n')}`;
        }
      }

      let retrievedContext = "";

      if (latestUserMsg && latestUserMsg.text && documentEmbeddings.length > 0) {
        try {
          const embedRes = await ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: latestUserMsg.text,
          });
          const queryEmbedding = embedRes.embeddings?.[0]?.values || [];
          
          if (queryEmbedding.length > 0) {
            const scoredDocs = documentEmbeddings.map(doc => ({
              ...doc,
              score: cosineSimilarity(queryEmbedding, doc.embedding)
            }));
            
            // Sort by score descending and take top 3
            scoredDocs.sort((a, b) => b.score - a.score);
            const topDocs = scoredDocs.slice(0, 3);
            
            retrievedContext = topDocs.map(d => `- **${d.title}**: ${d.content}`).join('\n');
            dynamicInstruction += `\n\nRelevant Knowledge Base Context:\n${retrievedContext}`;
          }
        } catch (e) {
          console.error("Embedding generation failed:", e);
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: history,
        config: {
          systemInstruction: dynamicInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Error in chat API:", error);
      res.status(500).json({ error: "Failed to process chat message." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support Express v5 signature for wildcard
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
