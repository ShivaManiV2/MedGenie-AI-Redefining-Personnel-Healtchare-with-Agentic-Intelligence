
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, TriageStep, CarePathway, AgentName, FollowUpLog, DigitalTwin } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SAFETY_INSTRUCTIONS = `
  STRICT SAFETY RULES:
  - NEVER state a definitive diagnosis.
  - ALWAYS include: "This is not medical advice. Consult a doctor."
  - If "Emergency" risk is detected, stop all other logic and insist on calling emergency services.
  - Disclaimer: "MediGenie recommendations are for informational purposes only. Do not exceed specified dosages."
  - ACTIVE LEARNING: If you are unsure about a clinical interpretation, DO NOT GUESS. Instead, ask the user a specific, clarifying medical question to reduce uncertainty.
`;

// 1. Twin Architect Agent: Updates the Digital Twin model based on logs and interactions
export const updateDigitalTwinAgent = async (profile: UserProfile, logs: FollowUpLog[]): Promise<DigitalTwin> => {
  const systemInstruction = `
    You are the Twin Architect Agent. 
    Your task is to maintain a "Patient Digital Twin" (a JSON-based computational model).
    Based on the profile and logs, update the vital trajectories, medication responses, and equilibrium status.
    LEARNING PATH: If data is missing for a specific trajectory (e.g. Heart Rate), mark the equilibriumStatus as 'Awaiting Data Signal'.
    Return ONLY valid JSON matching the DigitalTwin interface.
  `;

  const prompt = `
    Current Profile: ${JSON.stringify(profile)}
    History Logs: ${JSON.stringify(logs)}
    
    Construct an updated DigitalTwin model. Focus on extracting numerical trends from text notes.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction, responseMimeType: "application/json" },
  });

  return JSON.parse(response.text || '{}');
};

// 2. Counterfactual Simulator Agent (What-If Engine)
export const simulateCounterfactualAgent = async (twin: DigitalTwin, profile: UserProfile, scenario: string) => {
  const systemInstruction = `
    You are the Counterfactual Simulator Agent (Decision Intelligence Engine).
    Task: Use the Patient Digital Twin to simulate health outcomes for specific "What-If" scenarios.
    
    CRITICAL INSTRUCTION: Focus on outputting "Risk Deltas" (the change in risk profile) rather than direct medical advice.
    For example: "Simulating a 2-hour sleep increase suggests a 15% reduction in metabolic strain over 14 days."
    
    STRICT RULES:
    - Simulate multiple potential future trajectories.
    - Output quantitative risk shifts.
    - Maintain clinical neutrality.
    ${SAFETY_INSTRUCTIONS}
  `;

  const prompt = `
    Digital Twin State: ${JSON.stringify(twin)}
    User Profile: ${JSON.stringify(profile)}
    What-If Request: ${scenario}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction },
  });

  return response.text;
};

// 3. Prescription Safety Agent with Pricing & Grounding
export const prescriptionSafetyAgent = async (query: string, userProfile: UserProfile) => {
  const systemInstruction = `
    You are the Prescription Safety Agent. 
    Task: Recommend safe OTC medications, specify dosages, and provide real-time estimated market prices.
    You must use the googleSearch tool to find current pricing for recommended medications in retail pharmacies.
    
    UNCERTAINTY HANDLING: If the dosage or price is unclear from current grounding, state 'Pending Verification' and ask for the user's region or current medication list to refine results.

    JSON SCHEMA REQUIREMENTS:
    {
      "medication": "Name of drug",
      "dosage": "Clear dosage instructions",
      "price": "Estimated price range (e.g., $8.50 - $12.00)",
      "sideEffects": ["effect 1"],
      "warnings": ["warning 1"]
    }

    ${SAFETY_INSTRUCTIONS}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Provide treatment and current price estimate for: ${query}. User Allergies: ${userProfile.allergies.join(', ')}` }] }],
    config: { 
      systemInstruction, 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    },
  });

  return JSON.parse(response.text || '{}');
};

// --- Orchestration & Utility ---

export const chatWithMediGenie = async (message: string, imageData: string | null, history: any[], userProfile: UserProfile) => {
  const systemInstruction = `
    MediGenie Orchestrator. You manage a cluster of medical agents.
    LEARNING ENGINE: If you encounter an ambiguous symptom, ask a targeted follow-up question (e.g. 'How long has the pain lasted?') to improve the diagnostic reasoning path.
    ${SAFETY_INSTRUCTIONS}
  `;
  const userParts: any[] = [{ text: message }];
  if (imageData) {
    userParts.push({ 
      inlineData: { 
        data: imageData.split(',')[1], 
        mimeType: 'image/jpeg' 
      } 
    });
  }
  
  return await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [...history, { role: 'user', parts: userParts }],
    config: { systemInstruction, tools: [{ googleSearch: {} }] },
  });
};

export const summarizeHealthMemory = async (profile: UserProfile, logs: FollowUpLog[]) => {
  const systemInstruction = `Memory Agent. Synthesize history into a 2-3 sentence narrative. Highlight gaps in knowledge where the system needs more data for 'Active Learning'.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Profile: ${JSON.stringify(profile)}. Logs: ${JSON.stringify(logs.slice(0, 5))}.` }] }],
    config: { systemInstruction },
  });
  return response.text;
};

export const followUpAgent = async (profile: UserProfile, previousLogs: FollowUpLog[], currentUpdate: string) => {
  const systemInstruction = `Follow-up Coordinator. Review current status against history. Use uncertainty to prompt for missing metrics (like BP or HR) if not mentioned. ${SAFETY_INSTRUCTIONS}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Current: ${currentUpdate}. History: ${JSON.stringify(previousLogs.slice(0, 3))}` }] }],
    config: { systemInstruction },
  });
  return response.text;
};

export const checkDrugInteractions = async (medications: string[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Analyze interactions: ${medications.join(', ')}` }] }],
  });
  return response.text;
};

export const analyzeSymptomsAgent = async (input: string, imageData?: string) => {
  const parts: any[] = [{ text: input }];
  if (imageData) {
    parts.push({ 
      inlineData: { 
        data: imageData.split(',')[1], 
        mimeType: 'image/jpeg' 
      } 
    });
  }
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', contents: [{ role: 'user', parts }]
  });
  return response.text;
};

export const parseLabReport = async (content: string | { data: string; mimeType: string }) => {
  const parts: any[] = typeof content === 'string' ? [{ text: content }] : [{ inlineData: content }];
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', contents: [{ role: 'user', parts }]
  });
  return response.text;
};

export const searchMedicalInfo = async (query: string) => {
  return await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: query }] }],
    config: { tools: [{ googleSearch: {} }] },
  });
};

export const getNextTriageStep = async (p: UserProfile, s: string, h: any[]): Promise<TriageStep> => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Triage: ${s}. History: ${JSON.stringify(h)}` }] }],
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(res.text || '{}');
};

export const generateCarePathway = async (userProfile: UserProfile, symptoms: string, lifestyle?: any): Promise<CarePathway> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: `Pathway for: ${symptoms}. Lifestyle: ${JSON.stringify(lifestyle)}` }] }],
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || '{}');
};

export const findNearbyClinics = async (s: string, lat: number, lng: number) => {
  return await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: `Find ${s} clinics near me.` }] }],
    config: { 
      tools: [{ googleMaps: {} }], 
      toolConfig: { 
        retrievalConfig: { 
          latLng: { latitude: lat, longitude: lng } 
        } 
      } 
    },
  });
};
