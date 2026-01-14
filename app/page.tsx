'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [plantData, setPlantData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [plantImages, setPlantImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Start camera
  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera
      })
      setCameraStream(stream)
      setShowCamera(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setError('Could not access camera. Please check permissions.')
      console.error('Camera error:', err)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setShowCamera(false)
  }

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Draw video frame to canvas
      context?.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' })
          setImage(file)
          setPlantData(null)
          setError('')
          
          // Create preview URL
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
          
          // Stop camera after capture
          stopCamera()
        }
      }, 'image/jpeg', 0.95)
    }
  }

  // Fetch plant images from Unsplash based on plant name
  const fetchPlantImages = async (plantName: string) => {
    if (!plantName || plantName === 'Unknown Plant') return
    
    try {
      // Using Unsplash API (you'll need to get an API key from unsplash.com)
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(plantName)} plant&per_page=6&client_id=YOUR_UNSPLASH_API_KEY`
      )
      
      if (response.ok) {
        const data = await response.json()
        const images = data.results.map((photo: any) => photo.urls.regular)
        setPlantImages(images)
      }
    } catch (err) {
      console.error('Error fetching plant images:', err)
      // Fallback to placeholder images if Unsplash fails
      setPlantImages([
        '/placeholder-plant1.jpg',
        '/placeholder-plant2.jpg',
        '/placeholder-plant3.jpg'
      ])
    }
  }

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImage(file)
    setPlantData(null)
    setError('')
    setPlantImages([])

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleIdentifyPlant = async () => {
    if (!image) {
      setError('Please select or capture an image first')
      return
    }

    setLoading(true)
    setError('')
    setPlantImages([])
    
    const formData = new FormData()
    formData.append('image', image)

    try {
      const response = await fetch('/api/identify', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to identify plant')
      }

      setPlantData(data.data)
      
      // Fetch related images after successful identification
      if (data.data?.commonName) {
        fetchPlantImages(data.data.commonName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        setImage(file)
        setPlantData(null)
        setError('')
        setPlantImages([])
        
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      } else {
        setError('Please upload an image file')
      }
    }
  }

  // Example images for fallback
  const exampleImages = [
    { src: '/examples/rose.jpg', alt: 'Rose' },
    { src: '/examples/sunflower.jpg', alt: 'Sunflower' },
    { src: '/examples/orchid.jpg', alt: 'Orchid' },
    { src: '/examples/cactus.jpg', alt: 'Cactus' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Plant Identifier</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Take a photo or upload an image to identify any plant instantly with AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload & Camera Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Capture or Upload</h2>
            
            {/* Camera Interface */}
            {showCamera ? (
              <div className="mb-6">
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 md:h-80 object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-white text-gray-800 px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Capture Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="bg-red-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-red-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-sm text-center mt-2">
                  Point camera at plant and tap "Capture Photo"
                </p>
              </div>
            ) : (
              /* Upload Interface */
              <div 
                className={`border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-200 mb-6 ${
                  previewUrl 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !previewUrl && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden mb-4">
                    <Image
                      src={previewUrl}
                      alt="Plant preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                      priority={false}
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-gray-700 mb-2">
                      <span className="font-semibold text-green-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-gray-500 text-sm">
                      PNG, JPG, WebP up to 7MB
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={startCamera}
                disabled={showCamera}
                className={`py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  showCamera
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {showCamera ? 'Camera Active' : 'Take Photo'}
              </button>
              
              <button
                onClick={() => {
                  setImage(null)
                  setPreviewUrl('')
                  setPlantData(null)
                  setPlantImages([])
                  fileInputRef.current?.click()
                }}
                className="py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Image
              </button>
            </div>

            {/* Example Plants Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Try these examples:</h3>
              <div className="grid grid-cols-4 gap-2">
                {exampleImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      try {
                        // For demo purposes, you can load example images
                        // In production, you would fetch these from your server
                        const response = await fetch(img.src)
                        const blob = await response.blob()
                        const file = new File([blob], `${img.alt.toLowerCase()}.jpg`, { type: 'image/jpeg' })
                        setImage(file)
                        setPreviewUrl(img.src)
                        setPlantData(null)
                        setPlantImages([])
                      } catch (err) {
                        console.error('Error loading example image:', err)
                      }
                    }}
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-700">{img.alt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleIdentifyPlant}
              disabled={!image || loading}
              className={`w-full mt-4 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
                !image || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Identifying...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Identify Plant
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className="space-y-8">
            {/* Plant Information Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Plant Information</h2>
              
              {plantData ? (
                <div className="space-y-6 animate-fade-in">
                  {/* Identification Confidence */}
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    plantData.identificationConfidence === 'High' 
                      ? 'bg-green-100 text-green-800' 
                      : plantData.identificationConfidence === 'Medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {plantData.identificationConfidence} Confidence
                  </div>

                  {/* Plant Names */}
                  <div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-1">{plantData.commonName}</h3>
                    <p className="text-gray-600 italic">{plantData.scientificName}</p>
                    {plantData.family && <p className="text-gray-500 mt-1">Family: {plantData.family}</p>}
                    {plantData.nativeRegion && <p className="text-gray-500">Native to: {plantData.nativeRegion}</p>}
                  </div>

                  {/* Care Requirements */}
                  <div className="bg-green-50 rounded-xl p-5">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      Care Instructions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">💧 Watering</p>
                          <p className="text-gray-800">{plantData.careRequirements.watering}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">☀️ Sunlight</p>
                          <p className="text-gray-800">{plantData.careRequirements.sunlight}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">🪴 Soil</p>
                          <p className="text-gray-800">{plantData.careRequirements.soil}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">🌡️ Temperature</p>
                          <p className="text-gray-800">{plantData.careRequirements.temperature}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">💦 Humidity</p>
                          <p className="text-gray-800">{plantData.careRequirements.humidity}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">🌱 Fertilizing</p>
                          <p className="text-gray-800">{plantData.careRequirements.fertilizing}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interesting Facts */}
                  {plantData.interestingFacts && plantData.interestingFacts.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Interesting Facts
                      </h4>
                      <ul className="space-y-2">
                        {plantData.interestingFacts.map((fact: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-700">{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {plantData.warnings && plantData.warnings.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <h4 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Warnings
                      </h4>
                      <ul className="space-y-2">
                        {plantData.warnings.map((warning: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
                              <line x1="12" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <span className="text-red-700">{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Similar Plants */}
                  {plantData.similarPlants && plantData.similarPlants.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Similar Plants</h4>
                      <div className="flex flex-wrap gap-2">
                        {plantData.similarPlants.map((plant: string, index: number) => (
                          <span key={index} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
                            {plant}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Technical Info */}
                  <div className="text-sm text-gray-500 border-t pt-4">
                    <p>Analysis time: {plantData.responseTime || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-6 text-gray-300">
                    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Plant Identified Yet</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Take a photo or upload an image to get detailed plant information.
                  </p>
                </div>
              )}
            </div>

            {/* Related Images Gallery */}
            {plantImages.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  More Images of {plantData?.commonName}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {plantImages.map((imgUrl, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                      <Image
                        src={imgUrl}
                        alt={`${plantData?.commonName} image ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-sm text-center mt-4">
                  Showing related images for reference
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Powered by MJ • Built with Next.js & Tailwind CSS</p>
          <p className="mt-2">
            Need help? Check the{' '}
            <a 
              href="https://makersuite.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Gemini API documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}