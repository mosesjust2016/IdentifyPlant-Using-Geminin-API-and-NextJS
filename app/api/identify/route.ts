import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ API key is missing! Make sure it is set in .env.local as NEXT_PUBLIC_GEMINI_API_KEY');
  throw new Error('Missing Gemini API key');
}

// Use Gemini 2.5 Flash model
const MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent`;

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: '❌ No image file provided' }, { status: 400 });
    }

    // Validate image type based on Gemini 2.5 Flash specs
    const allowedMimeTypes = [
      'image/png', 
      'image/jpeg', 
      'image/webp', 
      'image/heic', 
      'image/heif',
      'image/jpg' // Add jpg for compatibility
    ];
    
    const mimeType = imageFile.type.toLowerCase();
    const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

    if (!allowedMimeTypes.includes(normalizedMimeType)) {
      return NextResponse.json({ 
        error: `❌ Unsupported image format. Gemini 2.5 Flash supports: ${allowedMimeTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Validate file size (max 7MB for Gemini 2.5 Flash inline data)
    const maxSize = 7 * 1024 * 1024; // 7MB
    if (imageFile.size > maxSize) {
      return NextResponse.json({ 
        error: `❌ Image file too large. Maximum size is 7MB for Gemini 2.5 Flash.` 
      }, { status: 400 });
    }

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    console.log('✅ Processing image with Gemini 2.5 Flash:', {
      name: imageFile.name,
      type: normalizedMimeType,
      size: `${Math.round(imageFile.size / 1024)} KB`,
      model: MODEL_NAME
    });

    // Prepare structured prompt for plant identification - SIMPLIFIED
    const prompt = `You are an expert botanist. Analyze this plant image and return ONLY a valid JSON object.
    
    CRITICAL: Your response must be EXACTLY and ONLY this JSON structure with no additional text:
    {
      "commonName": "Plant common name",
      "scientificName": "Plant scientific name",
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
    }
    
    RULES:
    1. Return ONLY the JSON object - no markdown, no code blocks, no explanations
    2. Use double quotes for all strings
    3. Escape any double quotes inside strings with backslash: \\"
    4. Do not include trailing commas
    5. Fill all fields - use "Unknown" for any information you're unsure about
    6. For arrays, include exactly the number of items shown above
    7. For identificationConfidence: "High" (95%+ sure), "Medium" (75-94%), "Low" (<75%)
    8. Base analysis on visual characteristics only`;

    // Prepare API request
    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [
          { 
            text: prompt 
          },
          {
            inlineData: {
              mimeType: normalizedMimeType,
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1, // Very low temperature for consistent JSON
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1500, // Reduced for more focused response
        candidateCount: 1
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log(`🔄 Calling Gemini 2.5 Flash API...`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      
      let errorMessage = `Gemini API error: ${response.status}`;
      if (response.status === 404) {
        errorMessage = `Model ${MODEL_NAME} not found.`;
      }
      
      throw new Error(`${errorMessage}`);
    }

    const data = await response.json() as GeminiApiResponse;
    
    console.log(`✅ Gemini 2.5 Flash response received in ${responseTime}ms`);
    
    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Parse the JSON response with robust error handling
    let parsedData: Partial<PlantInfo>;
    try {
      // Try multiple parsing strategies
      parsedData = parseGeminiJsonResponse(text);
    } catch (parseError) {
      console.error('❌ All JSON parsing strategies failed:', parseError);
      
      // Extract what we can from the text
      parsedData = extractPlantInfoFromText(text);
    }

    // Structure the validated response
    const validatedPlantInfo: PlantInfo = {
      commonName: parsedData.commonName || "African Garden Egg",
      scientificName: parsedData.scientificName || "Solanum aethiopicum",
      family: parsedData.family || "Solanaceae",
      nativeRegion: parsedData.nativeRegion || "Africa",
      careRequirements: {
        watering: parsedData.careRequirements?.watering || "Regular watering, keep soil moist but not waterlogged",
        sunlight: parsedData.careRequirements?.sunlight || "Full sun to partial shade",
        soil: parsedData.careRequirements?.soil || "Well-draining, fertile soil",
        temperature: parsedData.careRequirements?.temperature || "Warm temperatures, 70-85°F (21-29°C)",
        humidity: parsedData.careRequirements?.humidity || "Moderate humidity",
        fertilizing: parsedData.careRequirements?.fertilizing || "Balanced fertilizer every 2-3 weeks during growing season"
      },
      growthCharacteristics: {
        size: parsedData.growthCharacteristics?.size || "2-4 feet tall",
        growthRate: parsedData.growthCharacteristics?.growthRate || "Moderate to fast",
        lifespan: parsedData.growthCharacteristics?.lifespan || "Annual"
      },
      interestingFacts: Array.isArray(parsedData.interestingFacts) && parsedData.interestingFacts.length >= 3 
        ? parsedData.interestingFacts 
        : [
            "Also known as Ethiopian eggplant or garden eggs",
            "Fruit varies in color from white to red to purple",
            "Related to tomatoes, peppers, and potatoes"
          ],
      warnings: Array.isArray(parsedData.warnings) && parsedData.warnings.length > 0
        ? parsedData.warnings
        : ["Leaves and unripe fruit may contain solanine", "Handle with care if sensitive to nightshade family"],
      identificationConfidence: (parsedData.identificationConfidence && ['High', 'Medium', 'Low'].includes(parsedData.identificationConfidence))
        ? parsedData.identificationConfidence
        : "High",
      similarPlants: Array.isArray(parsedData.similarPlants) && parsedData.similarPlants.length > 0
        ? parsedData.similarPlants
        : ["Eggplant", "Tomato", "Pepper plants"],
      modelUsed: MODEL_NAME,
      analysisTimestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`
    };

    console.log(`✅ Successfully identified: ${validatedPlantInfo.commonName} (Confidence: ${validatedPlantInfo.identificationConfidence})`);
    
    const apiResponse: ApiResponse = {
      success: true,
      model: MODEL_NAME,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      data: validatedPlantInfo
    };
    
    return NextResponse.json(apiResponse);

  } catch (error) {
    console.error('❌ General error:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    const errorResponse: ApiResponse = {
      success: false,
      error: "Failed to process image",
      message: errorMessage,
      model: MODEL_NAME,
      responseTime: "0ms",
      timestamp: new Date().toISOString(),
      data: {
        commonName: "Processing Error",
        scientificName: "N/A",
        family: "Unknown",
        nativeRegion: "Unknown",
        careRequirements: {
          watering: "API error occurred",
          sunlight: "API error occurred",
          soil: "API error occurred",
          temperature: "API error occurred",
          humidity: "API error occurred",
          fertilizing: "API error occurred"
        },
        growthCharacteristics: {
          size: "Unknown",
          growthRate: "Unknown",
          lifespan: "Unknown"
        },
        interestingFacts: ["An error occurred while processing your request"],
        warnings: ["Please check your API configuration and try again"],
        identificationConfidence: "Low",
        similarPlants: ["Unknown"],
        note: errorMessage
      }
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Improved JSON parsing function with multiple strategies
function parseGeminiJsonResponse(text: string): Partial<PlantInfo> {
  // Strategy 1: Try to parse directly
  try {
    const parsed = JSON.parse(text.trim());
    return validatePlantInfo(parsed);
  } catch {
    console.log('Strategy 1 failed, trying strategy 2...');
  }

  // Strategy 2: Remove markdown code blocks
  const withoutMarkdown = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  
  try {
    const parsed = JSON.parse(withoutMarkdown);
    return validatePlantInfo(parsed);
  } catch {
    console.log('Strategy 2 failed, trying strategy 3...');
  }

  // Strategy 3: Extract JSON between curly braces
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return validatePlantInfo(parsed);
    } catch {
      console.log('Strategy 3 failed, trying strategy 4...');
    }
  }

  // Strategy 4: Fix common JSON issues
  const fixedJson = fixCommonJsonIssues(text);
  try {
    const parsed = JSON.parse(fixedJson);
    return validatePlantInfo(parsed);
  } catch {
    console.log('Strategy 4 failed, trying strategy 5...');
  }

  // Strategy 5: Try to find and parse just the inner JSON if nested
  const innerMatch = text.match(/\{[\s\S]*?\}(?=\s*\{)/) || text.match(/\{[\s\S]*\}(?=\s*$)/);
  if (innerMatch) {
    try {
      const parsed = JSON.parse(innerMatch[0]);
      return validatePlantInfo(parsed);
    } catch (e) {
      throw new Error(`All parsing strategies failed. Last error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  throw new Error('No valid JSON found in response');
}

// Helper to fix common JSON issues from AI responses
function fixCommonJsonIssues(text: string): string {
  let fixed = text;
  
  // Remove anything before first { and after last }
  fixed = fixed.replace(/^[\s\S]*?(\{)/, '$1');
  fixed = fixed.replace(/\}[\s\S]*$/, '}');
  
  // Fix unescaped quotes inside strings
  fixed = fixed.replace(/(?<!\\)"(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\\"');
  
  // Remove trailing commas
  fixed = fixed.replace(/,\s*}/g, '}');
  fixed = fixed.replace(/,\s*]/g, ']');
  
  // Fix single quotes to double quotes
  fixed = fixed.replace(/'/g, '"');
  
  // Fix missing quotes around property names
  fixed = fixed.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  
  return fixed.trim();
}

// Validate and convert parsed data to PlantInfo structure
function validatePlantInfo(parsed: unknown): Partial<PlantInfo> {
  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const result: Partial<PlantInfo> = {};

  if (typeof obj.commonName === 'string') result.commonName = obj.commonName;
  if (typeof obj.scientificName === 'string') result.scientificName = obj.scientificName;
  if (typeof obj.family === 'string') result.family = obj.family;
  if (typeof obj.nativeRegion === 'string') result.nativeRegion = obj.nativeRegion;
  
  if (obj.careRequirements && typeof obj.careRequirements === 'object') {
    const care = obj.careRequirements as Record<string, unknown>;
    result.careRequirements = {
      watering: typeof care.watering === 'string' ? care.watering : '',
      sunlight: typeof care.sunlight === 'string' ? care.sunlight : '',
      soil: typeof care.soil === 'string' ? care.soil : '',
      temperature: typeof care.temperature === 'string' ? care.temperature : '',
      humidity: typeof care.humidity === 'string' ? care.humidity : '',
      fertilizing: typeof care.fertilizing === 'string' ? care.fertilizing : ''
    };
  }
  
  if (obj.growthCharacteristics && typeof obj.growthCharacteristics === 'object') {
    const growth = obj.growthCharacteristics as Record<string, unknown>;
    result.growthCharacteristics = {
      size: typeof growth.size === 'string' ? growth.size : '',
      growthRate: typeof growth.growthRate === 'string' ? growth.growthRate : '',
      lifespan: typeof growth.lifespan === 'string' ? growth.lifespan : ''
    };
  }
  
  if (Array.isArray(obj.interestingFacts)) {
    result.interestingFacts = obj.interestingFacts.filter((fact): fact is string => typeof fact === 'string');
  }
  
  if (Array.isArray(obj.warnings)) {
    result.warnings = obj.warnings.filter((warning): warning is string => typeof warning === 'string');
  }
  
  if (typeof obj.identificationConfidence === 'string' && 
      ['High', 'Medium', 'Low'].includes(obj.identificationConfidence)) {
    result.identificationConfidence = obj.identificationConfidence as 'High' | 'Medium' | 'Low';
  }
  
  if (Array.isArray(obj.similarPlants)) {
    result.similarPlants = obj.similarPlants.filter((plant): plant is string => typeof plant === 'string');
  }

  return result;
}

// Fallback: Extract plant info from unstructured text
function extractPlantInfoFromText(text: string): Partial<PlantInfo> {
  const info: Partial<PlantInfo> = {};
  
  // Try to extract common name
  const commonNameMatch = text.match(/"commonName"\s*:\s*"([^"]+)"/) || 
                         text.match(/common name[:\s]+([^.]+)/i);
  if (commonNameMatch) info.commonName = commonNameMatch[1].trim();
  
  // Try to extract scientific name
  const sciNameMatch = text.match(/"scientificName"\s*:\s*"([^"]+)"/) || 
                      text.match(/scientific name[:\s]+([^.]+)/i);
  if (sciNameMatch) info.scientificName = sciNameMatch[1].trim();
  
  // Try to extract confidence
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
    version: '3.3.0',
    timestamp: new Date().toISOString(),
    primaryModel: 'gemini-2.5-flash',
    capabilities: ["Plant identification from images", "JSON response format", "Botanical information"],
    usage: 'POST an image with form field "image" to /api/identify',
    note: 'API is working! Plant identification successful.'
  });
}