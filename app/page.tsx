'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB

// Define types for the plant info structure matching the desired JSON format
interface PlantInfo {
  commonName: string;
  scientificName: string;
  careRequirements: string;
  interestingFacts: string;
  warnings: string;
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
      throw new Error('File size must be less than 4MB.')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    try {
      const file = e.target.files?.[0]
      validateFile(file)
      if (file) {
        setSelectedImage(file)
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Expect the API to return the JSON matching our PlantInfo type
      const data: PlantInfo = await response.json()
      setPlantInfo(data)
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
            <span className="text-sm text-gray-500 mt-1">(Max size: 4MB)</span>
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
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Plant Information</h2>
            <div className="space-y-4">
              {plantInfo.commonName && (
                <div>
                  <h3 className="font-semibold text-gray-700">Common Name</h3>
                  <p className="text-gray-700">{plantInfo.commonName}</p>
                </div>
              )}
              {plantInfo.scientificName && (
                <div>
                  <h3 className="font-semibold text-gray-700">Scientific Name</h3>
                  <p className="text-gray-700">{plantInfo.scientificName}</p>
                </div>
              )}
              {plantInfo.careRequirements && (
                <div>
                  <h3 className="font-semibold text-gray-700">Care Requirements</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {plantInfo.careRequirements}
                  </p>
                </div>
              )}
              {plantInfo.interestingFacts && (
                <div>
                  <h3 className="font-semibold text-gray-700">Interesting Facts</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {plantInfo.interestingFacts}
                  </p>
                </div>
              )}
              {plantInfo.warnings && (
                <div>
                  <h3 className="font-semibold text-gray-700">Warnings</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {plantInfo.warnings}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
