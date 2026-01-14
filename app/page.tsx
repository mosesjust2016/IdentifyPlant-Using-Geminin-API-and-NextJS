'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [plantData, setPlantData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [plantImages, setPlantImages] = useState<any[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* =========================
     START CAMERA (FIXED)
  ========================= */
  const startCamera = async () => {
    try {
      setError('')
      
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in your browser')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      setCameraStream(stream)
      setShowCamera(true)
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on your device.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera is currently in use by another application.')
      } else {
        setError('Could not access camera. Please check permissions.')
      }
    }
  }

  /* =========================
     ATTACH STREAM AFTER RENDER
  ========================= */
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      
      // Play the video when stream is attached
      videoRef.current.play().catch(err => {
        console.error('Video play error:', err)
      })
    }
  }, [cameraStream, showCamera])

  /* =========================
     STOP CAMERA
  ========================= */
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop()
      })
    }
    setCameraStream(null)
    setShowCamera(false)
  }

  /* =========================
     CAPTURE PHOTO (FIXED)
  ========================= */
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      console.error('Canvas context not available')
      return
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob and create file
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error('Failed to create image blob')
          return
        }

        // Create file from blob
        const file = new File([blob], 'captured-plant.jpg', { 
          type: 'image/jpeg',
          lastModified: Date.now()
        })
        
        // Set the captured image
        setImage(file)
        
        // Create preview URL
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        
        // Clear previous results
        setPlantData(null)
        setPlantImages([])
        setError('')
        
        // Stop camera after capture
        stopCamera()
        
        console.log('Photo captured successfully')
      },
      'image/jpeg',
      0.95 // Quality
    )
  }

  /* =========================
     FETCH RELATED IMAGES
  ========================= */
  const fetchPlantImages = async (searchTerms: string[], count: number = 6) => {
    if (!searchTerms || searchTerms.length === 0) {
      console.log('No search terms provided')
      return []
    }
    
    // Combine search terms for better results
    const query = searchTerms.slice(0, 3).join(' ')
    console.log('Searching for images with query:', query)
    
    try {
      // Call our own API endpoint
      const response = await fetch(`/api/images?query=${encodeURIComponent(query)}&count=${count}`)
      const data = await response.json()
      
      console.log('Image API response:', data)
      
      if (data.success && data.images && data.images.length > 0) {
        // Return full image objects with metadata
        return data.images.map((img: any) => ({
          url: img.urls.regular,
          thumb: img.urls.thumb,
          alt: img.alt_description || `Plant image`,
          photographer: img.user.name,
          photographerUrl: img.user.username ? `https://unsplash.com/@${img.user.username}` : 'https://unsplash.com',
          unsplashUrl: img.links.html
        }))
      } else if (data.images && data.images.length > 0) {
        // Fallback for mock images
        return data.images.map((img: any) => ({
          url: img.urls.regular,
          thumb: img.urls.thumb,
          alt: img.alt_description || `Plant image`,
          photographer: 'Botanical Photos',
          photographerUrl: 'https://unsplash.com',
          unsplashUrl: 'https://unsplash.com'
        }))
      }
      
      console.warn('No images found in response')
      return []
    } catch (err) {
      console.error('Error fetching similar images:', err)
      
      // Fallback to placeholder images
      return Array.from({ length: 4 }, (_, i) => ({
        url: `https://picsum.photos/600/400?random=${i}&plant=${encodeURIComponent(query)}`,
        thumb: `https://picsum.photos/150/100?random=${i}&plant=${encodeURIComponent(query)}`,
        alt: `${query} plant image`,
        photographer: 'Placeholder',
        photographerUrl: 'https://picsum.photos',
        unsplashUrl: 'https://picsum.photos'
      }))
    }
  }

  /* =========================
     CLEANUP ON UNMOUNT
  ========================= */
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  /* =========================
     IMAGE UPLOAD
  ========================= */
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, etc.)')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 10MB.')
      return
    }

    setImage(file)
    
    // Create preview URL and revoke old one if exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    
    setPlantData(null)
    setPlantImages([])
    setError('')
  }

  /* =========================
     DRAG AND DROP
  ========================= */
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
        
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        
        setPlantData(null)
        setPlantImages([])
        setError('')
      } else {
        setError('Please upload an image file')
      }
    }
  }

  /* =========================
     IDENTIFY PLANT
  ========================= */
  const handleIdentifyPlant = async () => {
    if (!image) {
      setError('Please upload or capture an image first')
      return
    }

    setLoading(true)
    setError('')
    setPlantImages([])

    const formData = new FormData()
    formData.append('image', image)

    try {
      console.log('Sending image for identification...')
      const res = await fetch('/api/identify', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      console.log('Identification response:', data)
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Identification failed')
      }

      setPlantData(data.data)
      
      // Fetch related images after successful identification
      if (data.data?.imageSearchTerms && data.data.imageCount) {
        console.log('Fetching images with terms:', data.data.imageSearchTerms)
        const images = await fetchPlantImages(data.data.imageSearchTerms, data.data.imageCount)
        console.log('Fetched images:', images.length)
        setPlantImages(images)
      } else if (data.data?.commonName) {
        // Fallback to just using the plant name
        console.log('Using plant name for image search:', data.data.commonName)
        const images = await fetchPlantImages([data.data.commonName], 6)
        setPlantImages(images)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during identification')
      console.error('Identification error:', err)
    } finally {
      setLoading(false)
    }
  }

  /* =========================
     RESET UPLOAD
  ========================= */
  const resetUpload = () => {
    setImage(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setPlantData(null)
    setPlantImages([])
    setError('')
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /* =========================
     CARE CARD COMPONENT
  ========================= */
  const CareCard = ({ 
    title, 
    description, 
    icon, 
    gardenTips,
    farmTips,
    color = 'green'
  }: {
    title: string
    description: string
    icon: string
    gardenTips?: string[]
    farmTips?: string[]
    color?: 'green' | 'blue' | 'yellow' | 'purple' | 'red' | 'orange'
  }) => {
    const colorClasses = {
      green: 'bg-green-50 border-green-200',
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      purple: 'bg-purple-50 border-purple-200',
      red: 'bg-red-50 border-red-200',
      orange: 'bg-orange-50 border-orange-200'
    }

    const iconColors = {
      green: 'text-green-600',
      blue: 'text-blue-600',
      yellow: 'text-yellow-600',
      purple: 'text-purple-600',
      red: 'text-red-600',
      orange: 'text-orange-600'
    }

    return (
      <div className={`rounded-xl border p-4 md:p-5 ${colorClasses[color]} hover:shadow-md transition-shadow duration-200`}>
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${colorClasses[color].replace('50', '100')} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-lg ${iconColors[color]}`}>{icon}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 text-lg mb-1">{title}</h4>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        </div>
        
        {(gardenTips || farmTips) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gardenTips && gardenTips.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    For Garden
                  </h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {gardenTips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {farmTips && farmTips.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    For Farm
                  </h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {farmTips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6"> {/* Increased max width */}

        {/* HEADER */}
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

        {/* CHANGED GRID LAYOUT: 1/3 for upload, 2/3 for results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Changed to 3 columns */}
          
          {/* LEFT COLUMN: UPLOAD & CAMERA - REDUCED WIDTH */}
          <div className="lg:col-span-1"> {/* Takes 1 out of 3 columns */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 sticky top-6"> {/* Made sticky */}
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Capture or Upload</h2>
              
              {/* CAMERA INTERFACE */}
              {showCamera ? (
                <div className="mb-6">
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 object-cover"
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
                /* UPLOAD INTERFACE */
                <div 
                  className={`border-3 border-dashed rounded-2xl p-6 text-center transition-all duration-200 mb-6 ${
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
                    <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
                      <Image
                        src={previewUrl}
                        alt="Plant preview"
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                        priority={false}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-gray-700 mb-2 text-sm">
                        <span className="font-semibold text-green-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-gray-500 text-xs">
                        PNG, JPG, WebP up to 10MB
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-3 mb-6"> {/* Reduced gap */}
                <button
                  onClick={startCamera}
                  disabled={showCamera}
                  className={`py-3 px-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                    showCamera
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {showCamera ? 'Camera Active' : 'Take Photo'}
                </button>
                
                <button
                  onClick={resetUpload}
                  className="py-3 px-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white hover:shadow-lg text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              </div>

              {/* ERROR DISPLAY */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* IDENTIFY BUTTON */}
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
          </div>

          {/* RIGHT COLUMN: RESULTS - INCREASED WIDTH */}
          <div className="lg:col-span-2 space-y-8"> {/* Takes 2 out of 3 columns */}
            {/* PLANT INFORMATION */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Plant Information</h2>
              
              {plantData ? (
                <div className="space-y-6 animate-fade-in">
                  {/* IDENTIFICATION CONFIDENCE */}
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

                  {/* PLANT NAMES */}
                  <div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-1">{plantData.commonName}</h3>
                    <p className="text-gray-600 italic">{plantData.scientificName}</p>
                    {plantData.family && <p className="text-gray-500 mt-1">Family: {plantData.family}</p>}
                    {plantData.nativeRegion && <p className="text-gray-500">Native to: {plantData.nativeRegion}</p>}
                  </div>

                  {/* CARE REQUIREMENTS - NEW CARD LAYOUT */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      Care Instructions for Garden & Farm
                    </h4>
                    
                    {/* CHANGED GRID: 3 cards per row on large screens */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Watering Card */}
                      <CareCard
                        title="Watering"
                        description={plantData.careRequirements?.watering || 'Regular watering schedule recommended'}
                        icon="💧"
                        color="blue"
                        gardenTips={plantData.gardenTips?.watering || [
                          'Water deeply 1-2 times per week',
                          'Morning watering prevents evaporation',
                          'Use mulch to retain soil moisture'
                        ]}
                        farmTips={plantData.farmTips?.watering || [
                          'Install drip irrigation system',
                          'Monitor soil moisture with sensors',
                          'Schedule watering based on weather'
                        ]}
                      />

                      {/* Sunlight Card */}
                      <CareCard
                        title="Sunlight"
                        description={plantData.careRequirements?.sunlight || 'Prefers bright indirect light'}
                        icon="☀️"
                        color="yellow"
                        gardenTips={plantData.gardenTips?.sunlight || [
                          'Provide 6-8 hours of sunlight',
                          'Use shade cloth in peak summer',
                          'Rotate plants for even exposure'
                        ]}
                        farmTips={plantData.farmTips?.sunlight || [
                          'Plan field layout for optimal sun',
                          'Monitor sun exposure patterns',
                          'Consider companion planting for shade'
                        ]}
                      />

                      {/* Temperature Card */}
                      <CareCard
                        title="Temperature"
                        description={plantData.careRequirements?.temperature || 'Thrives in moderate temperatures'}
                        icon="🌡️"
                        color="red"
                        gardenTips={plantData.gardenTips?.temperature || [
                          'Protect from frost with covers',
                          'Provide afternoon shade in heat',
                          'Monitor with garden thermometer'
                        ]}
                        farmTips={plantData.farmTips?.temperature || [
                          'Use row covers for temperature control',
                          'Plant according to hardiness zones',
                          'Monitor microclimates in fields'
                        ]}
                      />

                      {/* Humidity Card */}
                      <CareCard
                        title="Humidity"
                        description={plantData.careRequirements?.humidity || 'Prefers moderate humidity levels'}
                        icon="💦"
                        color="purple"
                        gardenTips={plantData.gardenTips?.humidity || [
                          'Group plants to raise humidity',
                          'Use pebble trays with water',
                          'Mist leaves in dry conditions'
                        ]}
                        farmTips={plantData.farmTips?.humidity || [
                          'Monitor field humidity levels',
                          'Consider overhead irrigation for humidity',
                          'Plant windbreaks to reduce drying'
                        ]}
                      />

                      {/* Soil Card */}
                      <CareCard
                        title="Soil"
                        description={plantData.careRequirements?.soil || 'Well-draining soil preferred'}
                        icon="🪴"
                        color="green"
                        gardenTips={plantData.gardenTips?.soil || [
                          'Add compost annually',
                          'Test soil pH regularly',
                          'Use raised beds for better drainage'
                        ]}
                        farmTips={plantData.farmTips?.soil || [
                          'Conduct soil tests each season',
                          'Rotate crops to maintain soil health',
                          'Use cover crops to enrich soil'
                        ]}
                      />

                      {/* Fertilizing Card */}
                      <CareCard
                        title="Fertilizing"
                        description={plantData.careRequirements?.fertilizing || 'Regular feeding during growing season'}
                        icon="🌱"
                        color="orange"
                        gardenTips={plantData.gardenTips?.fertilizing || [
                          'Use organic fertilizers monthly',
                          'Apply compost tea for nutrients',
                          'Fertilize after pruning'
                        ]}
                        farmTips={plantData.farmTips?.fertilizing || [
                          'Follow soil test recommendations',
                          'Use slow-release fertilizers',
                          'Time fertilization with growth stages'
                        ]}
                      />
                    </div>
                  </div>

                  {/* ADDITIONAL INFORMATION SECTION */}
                  {(plantData.growthCharacteristics?.size || 
                    plantData.interestingFacts?.length > 0 || 
                    plantData.warnings?.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Additional Information
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Growth Characteristics */}
                        {plantData.growthCharacteristics?.size && (
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h5 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                              </svg>
                              Growth Characteristics
                            </h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              <li>Size: {plantData.growthCharacteristics.size}</li>
                              <li>Growth Rate: {plantData.growthCharacteristics.growthRate}</li>
                              <li>Lifespan: {plantData.growthCharacteristics.lifespan}</li>
                            </ul>
                          </div>
                        )}

                        {/* Interesting Facts */}
                        {plantData.interestingFacts?.length > 0 && (
                          <div className="bg-blue-50 rounded-xl p-4">
                            <h5 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Interesting Facts
                            </h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {plantData.interestingFacts.slice(0, 3).map((fact: string, index: number) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span>{fact}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Warnings */}
                        {plantData.warnings?.length > 0 && (
                          <div className="bg-red-50 rounded-xl p-4">
                            <h5 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              Warnings & Precautions
                            </h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {plantData.warnings.slice(0, 3).map((warning: string, index: number) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-red-500 mt-0.5">•</span>
                                  <span>{warning}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TECHNICAL INFO */}
                  <div className="text-sm text-gray-500 border-t pt-4">
                    <p>Analysis time: {plantData.responseTime || 'N/A'}</p>
                    {plantData.modelUsed && <p>Model: {plantData.modelUsed}</p>}
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

            {/* RELATED IMAGES GALLERY */}
            {plantImages.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Related Images of {plantData?.commonName}
                  </h3>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {plantImages.length} images
                  </span>
                </div>
                
                {/* INCREASED IMAGE GRID: 4 columns on large screens */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {plantImages.map((img, index) => (
                    <div key={index} className="group relative aspect-square rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
                      <div className="relative w-full h-full">
                        <Image
                          src={img.url}
                          alt={img.alt}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        
                        {/* Photographer attribution overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-white text-xs truncate">
                            Photo by{' '}
                            <a 
                              href={img.photographerUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-semibold hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {img.photographer}
                            </a>
                          </p>
                        </div>
                      </div>
                      
                      {/* View on Unsplash link */}
                      <a
                        href={img.unsplashUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        title="View on Unsplash"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-gray-500 text-sm">
                    Showing similar images for reference • Powered by{' '}
                    <a 
                      href="https://unsplash.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      Unsplash
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Powered by MJ • Built with Next.js & Tailwind CSS</p>
          <p className="mt-2">
            Plant identification powered by{' '}
            <a 
              href="https://makersuite.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Google Gemini AI
            </a>
            {' • '}
            Images from{' '}
            <a 
              href="https://unsplash.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}