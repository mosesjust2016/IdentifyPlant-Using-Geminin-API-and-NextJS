import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ API key is missing! Make sure it is set in .env.local as NEXT_PUBLIC_GEMINI_API_KEY');
  throw new Error('Missing Gemini API key');
}

// Use Gemini 2.5 Flash model
const MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent`;

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

    // Prepare structured prompt for plant identification
    const prompt = `You are an expert botanist. Analyze this plant image and return ONLY a valid JSON object.
    
    CRITICAL: Your response must be EXACTLY and ONLY this JSON structure:
    {
      "commonName": "string",
      "scientificName": "string",
      "family": "string",
      "nativeRegion": "string",
      "careRequirements": {
        "watering": "string",
        "sunlight": "string",
        "soil": "string",
        "temperature": "string",
        "humidity": "string",
        "fertilizing": "string"
      },
      "growthCharacteristics": {
        "size": "string",
        "growthRate": "string",
        "lifespan": "string"
      },
      "interestingFacts": ["string", "string", "string"],
      "warnings": ["string", "string"],
      "identificationConfidence": "High/Medium/Low",
      "similarPlants": ["string", "string"]
    }
    
    Instructions:
    1. Return ONLY the JSON object, no markdown, no code blocks, no explanations
    2. Fill all fields with appropriate values
    3. If unknown, use "Unknown" for string fields
    4. For identificationConfidence: "High" = 95%+ sure, "Medium" = 75-94%, "Low" = <75%
    5. Base your analysis on visual characteristics only`;

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
        maxOutputTokens: 2000,
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
        errorMessage = `Model ${MODEL_NAME} not found. Trying fallback model...`;
        // Try fallback model
        return await tryFallbackModel(imageFile, base64Image, normalizedMimeType);
      } else if (response.status === 403) {
        errorMessage = "API key invalid or insufficient permissions";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 400) {
        errorMessage = "Invalid request parameters. Check your API configuration.";
      }
      
      throw new Error(`${errorMessage}`);
    }

    const data = await response.json();
    
    console.log(`✅ Gemini 2.5 Flash response received in ${responseTime}ms`);
    
    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Log the raw response for debugging
    console.log('📝 Raw Gemini response:');
    console.log('---START RAW RESPONSE---');
    console.log(text);
    console.log('---END RAW RESPONSE---');
    console.log(`📏 Response length: ${text.length} characters`);
    
    // Parse the JSON response
    try {
      // Clean the response text - remove any non-JSON content
      const cleanedText = cleanJsonResponse(text);
      
      // Log cleaned text for debugging
      console.log('🧹 Cleaned response:');
      console.log('---START CLEANED---');
      console.log(cleanedText);
      console.log('---END CLEANED---');
      
      let plantInfo;
      
      try {
        plantInfo = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('JSON parse error, trying to extract JSON:', parseError);
        // Log the position of the error for debugging
        if (parseError instanceof SyntaxError) {
          const match = parseError.message.match(/position (\d+)/);
          if (match) {
            const position = parseInt(match[1]);
            console.log(`🔍 Error at position ${position}:`);
            console.log(`   Context: ...${cleanedText.substring(Math.max(0, position - 50), position)}[HERE]${cleanedText.substring(position, position + 50)}...`);
          }
        }
        // Try to find JSON object if direct parse fails
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('🔧 Attempting to parse extracted JSON match');
          plantInfo = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON found in response");
        }
      }

      // Validate and structure the response
      const validatedPlantInfo = validateAndStructurePlantInfo(plantInfo);
      
      console.log(`✅ Successfully identified: ${validatedPlantInfo.commonName}`);
      
      return NextResponse.json({
        success: true,
        model: MODEL_NAME,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        data: validatedPlantInfo
      });

    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('❌ Failed text was:', text.substring(0, 500));
      
      // Return structured error response
      return NextResponse.json({
        success: false,
        error: "Failed to parse AI response",
        model: MODEL_NAME,
        rawResponsePreview: text.substring(0, 200),
        timestamp: new Date().toISOString(),
        data: createDefaultPlantInfo("Parse Error", "JSON parsing failed")
      }, { status: 200 });
    }

  } catch (error) {
    console.error('❌ General error:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json({
      success: false,
      error: "Failed to process image",
      message: errorMessage,
      model: MODEL_NAME,
      timestamp: new Date().toISOString(),
      data: createDefaultPlantInfo("Processing Error", "API error occurred")
    }, { status: 500 });
  }
}

// Helper function to clean JSON response
function cleanJsonResponse(text: string): string {
  let cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/^[\s\S]*?(\{)/, '$1')
    .replace(/\}[\s\S]*$/, '}')
    .trim();
  
  // Additional cleaning: fix common JSON issues from LLMs
  // Remove trailing commas before closing brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix unescaped quotes in string values (common LLM issue)
  // This is a basic fix - more complex cases may need manual handling
  
  return cleaned;
}

// Helper function to validate and structure plant info
function validateAndStructurePlantInfo(plantInfo: any) {
  return {
    commonName: plantInfo.commonName || "Unidentified Plant",
    scientificName: plantInfo.scientificName || "Unknown species",
    family: plantInfo.family || "Unknown family",
    nativeRegion: plantInfo.nativeRegion || "Unknown",
    careRequirements: {
      watering: plantInfo.careRequirements?.watering || "Water when top inch of soil is dry",
      sunlight: plantInfo.careRequirements?.sunlight || "Bright, indirect light",
      soil: plantInfo.careRequirements?.soil || "Well-draining potting mix",
      temperature: plantInfo.careRequirements?.temperature || "65-80°F (18-27°C)",
      humidity: plantInfo.careRequirements?.humidity || "Moderate to high humidity",
      fertilizing: plantInfo.careRequirements?.fertilizing || "Monthly during growing season"
    },
    growthCharacteristics: {
      size: plantInfo.growthCharacteristics?.size || "Varies by species",
      growthRate: plantInfo.growthCharacteristics?.growthRate || "Moderate",
      lifespan: plantInfo.growthCharacteristics?.lifespan || "Perennial"
    },
    interestingFacts: Array.isArray(plantInfo.interestingFacts) && plantInfo.interestingFacts.length >= 3 
      ? plantInfo.interestingFacts 
      : ["Plants convert CO2 to oxygen", "Improve indoor air quality", "Can reduce stress levels"],
    warnings: Array.isArray(plantInfo.warnings) && plantInfo.warnings.length > 0
      ? plantInfo.warnings
      : ["Always verify plant identification", "Wash hands after handling plants"],
    identificationConfidence: ["High", "Medium", "Low"].includes(plantInfo.identificationConfidence)
      ? plantInfo.identificationConfidence
      : "Medium",
    similarPlants: Array.isArray(plantInfo.similarPlants) && plantInfo.similarPlants.length > 0
      ? plantInfo.similarPlants
      : ["Various ornamental plants"],
    modelUsed: MODEL_NAME,
    analysisTimestamp: new Date().toISOString()
  };
}

// Helper function to create default plant info
function createDefaultPlantInfo(name: string, note: string) {
  return {
    commonName: name,
    scientificName: "N/A",
    family: "Unknown",
    nativeRegion: "Unknown",
    careRequirements: {
      watering: note,
      sunlight: note,
      soil: note,
      temperature: note,
      humidity: note,
      fertilizing: note
    },
    growthCharacteristics: {
      size: "Unknown",
      growthRate: "Unknown",
      lifespan: "Unknown"
    },
    interestingFacts: ["Unable to process image", "Please try again", "Check image quality"],
    warnings: ["Unable to determine toxicity", "Handle with care"],
    identificationConfidence: "Low",
    similarPlants: ["Unknown"],
    note: note
  };
}

// Fallback function if Gemini 2.5 Flash fails
async function tryFallbackModel(imageFile: File, base64Image: string, mimeType: string) {
  const fallbackModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro', 
    'gemini-pro-vision',
    'gemini-1.0-pro-vision'
  ];

  for (const model of fallbackModels) {
    try {
      console.log(`🔄 Trying fallback model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const prompt = `Identify this plant and return ONLY JSON: {
        "commonName": "",
        "scientificName": "",
        "careRequirements": {"watering":"","sunlight":"","soil":"","temperature":"","humidity":""},
        "interestingFacts": ["","",""],
        "warnings": [""],
        "identificationConfidence": "High/Medium/Low"
      }`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Image } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        // Log fallback response too
        console.log(`📝 Fallback model ${model} raw response:`, text);
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const plantInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        
        return NextResponse.json({
          success: true,
          model: model,
          note: `Used fallback model: ${model}`,
          timestamp: new Date().toISOString(),
          data: validateAndStructurePlantInfo(plantInfo)
        });
      }
    } catch (error) {
      console.log(`❌ Fallback model ${model} failed:`, error);
      continue;
    }
  }

  // If all fallbacks fail, return error
  return NextResponse.json({
    success: false,
    error: "All models failed. Check API key and model access.",
    timestamp: new Date().toISOString(),
    data: createDefaultPlantInfo("Model Error", "No working models available")
  }, { status: 503 });
}

// GET endpoint for API information
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    service: 'Plant Identifier API',
    version: '3.1.0',
    timestamp: new Date().toISOString(),
    primaryModel: 'gemini-2.5-flash',
    capabilities: ["Plant identification from images", "JSON response format", "Botanical information"],
    usage: 'POST an image with form field "image" to /api/identify'
  });
}