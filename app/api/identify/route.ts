import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Ensure API key is available
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is missing! Make sure it is set in .env')
  throw new Error('Missing GEMINI_API_KEY')
}

const genAI = new GoogleGenerativeAI(apiKey)

export async function POST(request: NextRequest) {
  try {
    // Get the form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: '❌ No image file provided' }, { status: 400 })
    }

    // Validate image type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    const mimeType = imageFile.type

    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json({ error: '❌ Unsupported image format' }, { status: 400 })
    }

    // Convert image to Uint8Array (Vercel-friendly)
    const imageBuffer = new Uint8Array(await imageFile.arrayBuffer())

    console.log('✅ Received Image:', {
      name: imageFile.name,
      type: mimeType,
      size: imageBuffer.byteLength
    })

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Prepare request payload for Gemini
    const imageData = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString('base64'),
        mimeType
      }
    }

    console.log('Sending request to Gemini API...')

    // Make the API call
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Identify this plant and provide the following information:\n' +
              '1. Common name\n' +
              '2. Scientific name\n' +
              '3. Care requirements (Water, Sunlight, Soil)\n' +
              '4. Interesting facts\n' +
              '5. Any warnings (Toxic to pets/humans)' },
            imageData
          ]
        }
      ]
    })

    console.log('✅ AI Response:', result)

    if (!result?.response?.candidates?.length) {
      return NextResponse.json({ error: '❌ AI did not return a valid response.' }, { status: 500 })
    }

    // Extract response text safely
    const responseText = result.response.candidates[0]?.content?.parts
      ?.map(part => ('text' in part ? part.text : ''))
      .join(' ') || 'No response from AI'

    console.log('✅ Extracted Response Text:', responseText)

    // Parse the response into structured plant info
    const plantInfo = parsePlantInfo(responseText)

    return NextResponse.json(plantInfo)
  } catch (error) {
    console.error('❌ Error processing image:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

function parsePlantInfo(analysis: string) {
  const sections = {
    commonName: '',
    scientificName: '',
    careRequirements: '',
    interestingFacts: '',
    warnings: ''
  };

  // Use regex to extract information
  const commonNameMatch = analysis.match(/1\.\s*\*\*Common name:\*\*\s*([^\n]+)/i);
  const scientificNameMatch = analysis.match(/2\.\s*\*\*Scientific name:\*\*\s*([^\n]+)/i);
  const careRequirementsMatch = analysis.match(/3\.\s*\*\*Care Requirements:\*\*\s*([\s\S]*?)(?=\n\d+\.)/i);
  const interestingFactsMatch = analysis.match(/4\.\s*\*\*Interesting Facts:\*\*\s*([\s\S]*?)(?=\n\d+\.)/i);
  const warningsMatch = analysis.match(/5\.\s*\*\*Warnings:\*\*\s*([\s\S]*)/i);

  if (commonNameMatch) sections.commonName = commonNameMatch[1].trim();
  if (scientificNameMatch) sections.scientificName = scientificNameMatch[1].trim();
  if (careRequirementsMatch) sections.careRequirements = careRequirementsMatch[1].trim();
  if (interestingFactsMatch) sections.interestingFacts = interestingFactsMatch[1].trim();
  if (warningsMatch) sections.warnings = warningsMatch[1].trim();

  return sections;
}
