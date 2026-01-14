'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

const MAX_FILE_SIZE = 7 * 1024 * 1024 // 7MB to match API

// Define types matching the API response structure
interface CareRequirements {
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
  careRequirements: CareRequirements;
  growthCharacteristics: GrowthCharacteristics;
  interestingFacts: string[];
  warnings: string[];
  identificationConfidence: string;
  similarPlants: string[];
  modelUsed?: string;
  analysisTimestamp?: string;
}

interface ApiResponse {
  success: boolean;
  model?: string;
  responseTime?: string;
  timestamp?: string;
  data: PlantInfo;
  error?: string;
  message?: string;
}

interface ErrorAlertProps {
  message: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message }) => (
  <div className="mt-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
    {message}
  </div>
)

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [plantInfo, setPlantInfo] = useState<PlantInfo | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File | undefined): void => {
    if (!file) {
      throw new Error('Please select an image file.')
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file (JPEG, PNG, etc.).')
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be less than 7MB.')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    try {
      const file = e.target.files?.[0]
      validateFile(file)
      if (file) {
        setSelectedImage(file)
        setPlantInfo(null) // Reset previous results
        setError(null)
        const objectUrl = URL.createObjectURL(file)
        setPreview(objectUrl)
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  const identifyPlant = async (): Promise<void> => {
    if (!selectedImage) {
      setError('No image selected')
      return
    }

    setLoading(true)
    setError(null)
    setPlantInfo(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)

      const response = await fetch('/api/identify', {
        method: 'POST',
        body: formData,
      })

      const data: ApiResponse = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`)
      }

      setPlantInfo(data.data)
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error identifying plant: ${err.message}`)
      } else {
        setError('Error identifying plant. Please try again.')
      }
      console.error('Processing Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'text-green-600 bg-green-100'
      case 'Medium': return 'text-yellow-600 bg-yellow-100'
      case 'Low': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-green-800 mb-4">Plant Identifier</h1>
        <p className="text-lg text-gray-600">
          Upload a photo of any plant to identify it and learn more
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col items-center justify-center">
          <label
            className="w-full max-w-lg h-64 flex flex-col items-center justify-center border-2 border-dashed border-green-300 rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
            htmlFor="plant-image"
          >
            <Upload className="w-12 h-12 text-green-500 mb-2" />
            <span className="text-gray-600">Click to upload a plant image</span>
            <span className="text-sm text-gray-500 mt-1">(Max size: 7MB)</span>
            <input
              id="plant-image"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </label>

          {preview && (
            <div className="mt-8 relative w-full max-w-lg h-64">
              <img
                src={preview}
                alt="Uploaded plant"
                className="rounded-lg object-cover w-full h-full"
              />
            </div>
          )}

          {preview && !loading && !plantInfo && (
            <button
              onClick={identifyPlant}
              className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Identify Plant
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
            <p className="mt-2 text-gray-600">Analyzing your plant...</p>
          </div>
        )}

        {error && <ErrorAlert message={error} />}

        {plantInfo && (
          <div className="mt-8 p-6 bg-green-50 rounded-lg">
            {/* Header with name and confidence */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{plantInfo.commonName}</h2>
                <p className="text-lg text-gray-600 italic">{plantInfo.scientificName}</p>
                <p className="text-sm text-gray-500">Family: {plantInfo.family}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(plantInfo.identificationConfidence)}`}>
                {plantInfo.identificationConfidence} Confidence
              </span>
            </div>

            {/* Native Region */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">🌍 Native Region</h3>
              <p className="text-gray-700">{plantInfo.nativeRegion}</p>
            </div>

            {/* Care Requirements */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">🌱 Care Requirements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-blue-600">💧 Watering:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.watering}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-yellow-600">☀️ Sunlight:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.sunlight}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-amber-700">🪴 Soil:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.soil}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-red-500">🌡️ Temperature:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.temperature}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-cyan-600">💨 Humidity:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.humidity}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <span className="font-medium text-green-600">🧪 Fertilizing:</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.careRequirements.fertilizing}</p>
                </div>
              </div>
            </div>

            {/* Growth Characteristics */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">📏 Growth Characteristics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg text-center">
                  <span className="font-medium text-gray-600">Size</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.growthCharacteristics.size}</p>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <span className="font-medium text-gray-600">Growth Rate</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.growthCharacteristics.growthRate}</p>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <span className="font-medium text-gray-600">Lifespan</span>
                  <p className="text-gray-700 text-sm mt-1">{plantInfo.growthCharacteristics.lifespan}</p>
                </div>
              </div>
            </div>

            {/* Interesting Facts */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">✨ Interesting Facts</h3>
              <ul className="space-y-2">
                {plantInfo.interestingFacts.map((fact, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span className="text-gray-700">{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            {plantInfo.warnings.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-red-700 mb-3">⚠️ Warnings</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <ul className="space-y-2">
                    {plantInfo.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span className="text-red-700">{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Similar Plants */}
            {plantInfo.similarPlants.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-3">🌿 Similar Plants</h3>
                <div className="flex flex-wrap gap-2">
                  {plantInfo.similarPlants.map((plant, index) => (
                    <span key={index} className="bg-white px-3 py-1 rounded-full text-sm text-gray-600 border">
                      {plant}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Try another button */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setPlantInfo(null)
                  setPreview(null)
                  setSelectedImage(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Identify Another Plant
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}