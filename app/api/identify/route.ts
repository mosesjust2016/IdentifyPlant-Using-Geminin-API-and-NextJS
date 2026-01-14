import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ API key is missing! Make sure it is set in .env.local as NEXT_PUBLIC_GEMINI_API_KEY');
  throw new Error('Missing Gemini API key');
}

// Use Gemini 2.5 Flash model with fallbacks
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
];

// Define TypeScript interfaces for plant data
interface PlantCareRequirements {
  watering: string;
  sunlight: string;
  soil: string;
  temperature: string;
  humidity: string;
  fertilizing: string;
}

interface GrowthCharacteristics {
  size: string;
  growthRate: string;
  lifespan: string;
}

interface PlantInfo {
  commonName: string;
  scientificName: string;
  family: string;
  nativeRegion: string;
  careRequirements: PlantCareRequirements;
  growthCharacteristics: GrowthCharacteristics;
  interestingFacts: string[];
  warnings: string[];
  identificationConfidence: 'High' | 'Medium' | 'Low';
  similarPlants: string[];
  modelUsed?: string;
  analysisTimestamp?: string;
  responseTime?: string;
  note?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface ApiResponse {
  success: boolean;
  model: string;
  responseTime: string;
  timestamp: string;
  data: PlantInfo;
  error?: string;
  message?: string;
  rawResponsePreview?: string;
}

// Helper function to sleep/delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to call Gemini API with retry logic
async function callGeminiAPI(
  model: string, 
  prompt: string, 
  base64Image: string, 
  mimeType: string,
  retryCount = 0
): Promise<{ data: GeminiApiResponse; modelUsed: string }> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const requestBody = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Image } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1500,
      candidateCount: 1
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };

  try {
    console.log(`🔄 Calling Gemini API with model: ${model} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = errorText ? JSON.parse(errorText) : {};
      
      // Handle specific error cases
      if (response.status === 503 || response.status === 429) {
        // Rate limiting or overload - retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
          console.log(`⏳ Model ${model} overloaded. Retrying in ${delay}ms...`);
          await sleep(delay);
          return callGeminiAPI(model, prompt, base64Image, mimeType, retryCount + 1);
        } else {
          throw new Error(`Model ${model} is overloaded after ${maxRetries} retries.`);
        }
      } else if (response.status === 404) {
        // Model not found - throw error to try next model
        throw new Error(`Model ${model} not found.`);
      } else {
        // Other errors
        throw new Error(`API error ${response.status}: ${errorData.error?.message || errorText}`);
      }
    }

    const data = await response.json() as GeminiApiResponse;
    console.log(`✅ Success with model: ${model}`);
    return { data, modelUsed: model };
    
  } catch (error) {
    if (retryCount < maxRetries && 
        (error instanceof Error && (
          error.message.includes('overloaded') || 
          error.message.includes('503') ||
          error.message.includes('429')
        ))) {
      const delay = baseDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retryable error. Retrying in ${delay}ms...`);
      await sleep(delay);
      return callGeminiAPI(model, prompt, base64Image, mimeType, retryCount + 1);
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: '❌ No image file provided' }, { status: 400 });
    }

    // Validate image type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/jpg'];
    const mimeType = imageFile.type.toLowerCase();
    const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

    if (!allowedMimeTypes.includes(normalizedMimeType)) {
      return NextResponse.json({ 
        error: `❌ Unsupported image format. Supported formats: ${allowedMimeTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Validate file size (max 7MB)
    const maxSize = 7 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return NextResponse.json({ 
        error: `❌ Image file too large. Maximum size is 7MB.` 
      }, { status: 400 });
    }

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    console.log('✅ Processing image:', {
      name: imageFile.name,
      type: normalizedMimeType,
      size: `${Math.round(imageFile.size / 1024)} KB`
    });

    // Prepare structured prompt
    const prompt = `Analyze this plant image and return ONLY valid JSON:
    {
      "commonName": "Common name",
      "scientificName": "Scientific name",
      "family": "Plant family",
      "nativeRegion": "Native region",
      "careRequirements": {
        "watering": "Watering instructions",
        "sunlight": "Sunlight requirements",
        "soil": "Soil type",
        "temperature": "Temperature range",
        "humidity": "Humidity needs",
        "fertilizing": "Fertilizing schedule"
      },
      "growthCharacteristics": {
        "size": "Mature size",
        "growthRate": "Growth rate",
        "lifespan": "Plant lifespan"
      },
      "interestingFacts": ["Fact 1", "Fact 2", "Fact 3"],
      "warnings": ["Warning 1", "Warning 2"],
      "identificationConfidence": "High/Medium/Low",
      "similarPlants": ["Similar plant 1", "Similar plant 2"]
    }`;

    // Try models in order with fallbacks
    let apiResult;
    let lastError: Error | null = null;
    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

    for (const model of modelsToTry) {
      try {
        apiResult = await callGeminiAPI(model, prompt, base64Image, normalizedMimeType);
        break; // Exit loop on success
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Model ${model} failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        // If it's a 404 (model not found), try next model immediately
        if (error instanceof Error && error.message.includes('not found')) {
          continue;
        }
        
        // For other errors, wait a bit before trying next model
        await sleep(500);
      }
    }

    if (!apiResult) {
      // All models failed
      const responseTime = Date.now() - startTime;
      
      return NextResponse.json({
        success: false,
        error: "All Gemini models are currently unavailable",
        message: lastError?.message || "Service overloaded. Please try again in a few moments.",
        model: "None",
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        data: {
          commonName: "Service Unavailable",
          scientificName: "N/A",
          family: "Unknown",
          nativeRegion: "Unknown",
          careRequirements: {
            watering: "Gemini API is currently overloaded",
            sunlight: "Please try again in a few minutes",
            soil: "The AI service is experiencing high demand",
            temperature: "Temporary service interruption",
            humidity: "Try during off-peak hours",
            fertilizing: "Check back soon"
          },
          growthCharacteristics: {
            size: "Unknown",
            growthRate: "Unknown",
            lifespan: "Unknown"
          },
          interestingFacts: ["AI services can experience temporary overload", "Try again in 5-10 minutes", "Consider uploading during less busy hours"],
          warnings: ["Service temporarily unavailable"],
          identificationConfidence: "Low",
          similarPlants: ["Unknown"],
          note: "All Gemini models are currently overloaded. Please try again later."
        }
      }, { status: 503 });
    }

    const { data, modelUsed } = apiResult;
    const responseTime = Date.now() - startTime;
    
    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Parse the JSON response
    let parsedData: Partial<PlantInfo>;
    try {
      parsedData = parseGeminiJsonResponse(text);
    } catch {
      parsedData = extractPlantInfoFromText(text);
    }

    // Structure the validated response
    const validatedPlantInfo: PlantInfo = {
      commonName: parsedData.commonName || "Plant",
      scientificName: parsedData.scientificName || "Unknown species",
      family: parsedData.family || "Unknown family",
      nativeRegion: parsedData.nativeRegion || "Unknown",
      careRequirements: {
        watering: parsedData.careRequirements?.watering || "Water when top inch of soil is dry",
        sunlight: parsedData.careRequirements?.sunlight || "Bright indirect light",
        soil: parsedData.careRequirements?.soil || "Well-draining potting mix",
        temperature: parsedData.careRequirements?.temperature || "65-80°F (18-27°C)",
        humidity: parsedData.careRequirements?.humidity || "Moderate humidity",
        fertilizing: parsedData.careRequirements?.fertilizing || "Monthly during growing season"
      },
      growthCharacteristics: {
        size: parsedData.growthCharacteristics?.size || "Varies by species",
        growthRate: parsedData.growthCharacteristics?.growthRate || "Moderate",
        lifespan: parsedData.growthCharacteristics?.lifespan || "Perennial"
      },
      interestingFacts: Array.isArray(parsedData.interestingFacts) && parsedData.interestingFacts.length >= 3 
        ? parsedData.interestingFacts 
        : [
            "Plants help purify indoor air",
            "Can improve mental well-being",
            "Convert CO2 to oxygen"
          ],
      warnings: Array.isArray(parsedData.warnings) && parsedData.warnings.length > 0
        ? parsedData.warnings
        : ["Always verify plant identification", "Wash hands after handling"],
      identificationConfidence: (parsedData.identificationConfidence && ['High', 'Medium', 'Low'].includes(parsedData.identificationConfidence))
        ? parsedData.identificationConfidence
        : "Medium",
      similarPlants: Array.isArray(parsedData.similarPlants) && parsedData.similarPlants.length > 0
        ? parsedData.similarPlants
        : ["Various ornamental plants"],
      modelUsed,
      analysisTimestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`
    };

    console.log(`✅ Successfully identified: ${validatedPlantInfo.commonName} using ${modelUsed} (${responseTime}ms)`);
    
    return NextResponse.json({
      success: true,
      model: modelUsed,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      data: validatedPlantInfo
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ General error:', error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to process image",
      message: error instanceof Error ? error.message : "Unknown error",
      model: "Error",
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      data: {
        commonName: "Processing Error",
        scientificName: "N/A",
        family: "Unknown",
        nativeRegion: "Unknown",
        careRequirements: {
          watering: "Error occurred",
          sunlight: "Error occurred",
          soil: "Error occurred",
          temperature: "Error occurred",
          humidity: "Error occurred",
          fertilizing: "Error occurred"
        },
        growthCharacteristics: {
          size: "Unknown",
          growthRate: "Unknown",
          lifespan: "Unknown"
        },
        interestingFacts: ["An error occurred", "Please try again", "Check your connection"],
        warnings: ["Service error - try again"],
        identificationConfidence: "Low",
        similarPlants: ["Unknown"],
        note: error instanceof Error ? error.message : "Unknown error"
      }
    }, { status: 500 });
  }
}

// Improved JSON parsing function
function parseGeminiJsonResponse(text: string): Partial<PlantInfo> {
  // Try to extract JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  try {
    // Clean and parse
    const cleanText = jsonMatch[0]
      .replace(/```json|```/g, '')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .trim();
    
    const parsed = JSON.parse(cleanText);
    
    // Validate and return
    const result: Partial<PlantInfo> = {};
    if (typeof parsed.commonName === 'string') result.commonName = parsed.commonName;
    if (typeof parsed.scientificName === 'string') result.scientificName = parsed.scientificName;
    if (typeof parsed.family === 'string') result.family = parsed.family;
    if (typeof parsed.nativeRegion === 'string') result.nativeRegion = parsed.nativeRegion;
    
    if (parsed.careRequirements && typeof parsed.careRequirements === 'object') {
      const care = parsed.careRequirements as Record<string, unknown>;
      result.careRequirements = {
        watering: typeof care.watering === 'string' ? care.watering : '',
        sunlight: typeof care.sunlight === 'string' ? care.sunlight : '',
        soil: typeof care.soil === 'string' ? care.soil : '',
        temperature: typeof care.temperature === 'string' ? care.temperature : '',
        humidity: typeof care.humidity === 'string' ? care.humidity : '',
        fertilizing: typeof care.fertilizing === 'string' ? care.fertilizing : ''
      };
    }
    
    if (parsed.growthCharacteristics && typeof parsed.growthCharacteristics === 'object') {
      const growth = parsed.growthCharacteristics as Record<string, unknown>;
      result.growthCharacteristics = {
        size: typeof growth.size === 'string' ? growth.size : '',
        growthRate: typeof growth.growthRate === 'string' ? growth.growthRate : '',
        lifespan: typeof growth.lifespan === 'string' ? growth.lifespan : ''
      };
    }
    
    if (Array.isArray(parsed.interestingFacts)) {
      result.interestingFacts = parsed.interestingFacts.filter((f: unknown) => typeof f === 'string');
    }
    
    if (Array.isArray(parsed.warnings)) {
      result.warnings = parsed.warnings.filter((w: unknown) => typeof w === 'string');
    }
    
    if (typeof parsed.identificationConfidence === 'string' && 
        ['High', 'Medium', 'Low'].includes(parsed.identificationConfidence)) {
      result.identificationConfidence = parsed.identificationConfidence as 'High' | 'Medium' | 'Low';
    }
    
    if (Array.isArray(parsed.similarPlants)) {
      result.similarPlants = parsed.similarPlants.filter((p: unknown) => typeof p === 'string');
    }
    
    return result;
  } catch {
    throw new Error('Failed to parse JSON');
  }
}

// Fallback: Extract plant info from unstructured text
function extractPlantInfoFromText(text: string): Partial<PlantInfo> {
  const info: Partial<PlantInfo> = {};
  
  const commonNameMatch = text.match(/"commonName"\s*:\s*"([^"]+)"/) || text.match(/common name[:\s]+([^.]+)/i);
  if (commonNameMatch) info.commonName = commonNameMatch[1].trim();
  
  const sciNameMatch = text.match(/"scientificName"\s*:\s*"([^"]+)"/) || text.match(/scientific name[:\s]+([^.]+)/i);
  if (sciNameMatch) info.scientificName = sciNameMatch[1].trim();
  
  const confidenceMatch = text.match(/"identificationConfidence"\s*:\s*"([^"]+)"/) ||
                         text.match(/confidence[:\s]+(High|Medium|Low)/i);
  if (confidenceMatch && ['High', 'Medium', 'Low'].includes(confidenceMatch[1])) {
    info.identificationConfidence = confidenceMatch[1] as 'High' | 'Medium' | 'Low';
  }
  
  return info;
}

// GET endpoint for API information
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    service: 'Plant Identifier API',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Automatic retry on overload (503 errors)',
      'Multiple model fallbacks',
      'Exponential backoff retry logic',
      'Graceful degradation'
    ],
    models: {
      primary: PRIMARY_MODEL,
      fallbacks: FALLBACK_MODELS
    },
    usage: 'POST an image with form field "image" to /api/identify'
  });
}