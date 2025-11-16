// This is the backend code for: netlify/functions/getTtsAudio.ts

// This imports the types for Netlify's serverless functions
import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  // 1. Get the secret key from Netlify's secure environment
  // We'll set this in the Netlify dashboard later
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key is not configured." }),
    };
  }

  // 2. Get the 'text' sent from your App.tsx file
  let text;
  try {
    text = JSON.parse(event.body || "{}").text;
    if (!text) {
      throw new Error("No text provided.");
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body." }),
    };
  }

  // 3. Prepare the API call to Google
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [{ text: `Say in a relaxed, easy-going, medium-pitched voice: ${text}` }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { voiceName: "Callirrhoe" }
      }
    },
    model: "gemini-2.5-flash-preview-tts"
  };

  try {
    // 4. Call the Google API *from the server*
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`TTS API request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    const part = result?.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;

    if (!audioData) {
      throw new Error("Invalid TTS response from Google");
    }

    // 5. Send just the audio data back to your App.tsx
    return {
      statusCode: 200,
      body: JSON.stringify({ audioData: audioData }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
