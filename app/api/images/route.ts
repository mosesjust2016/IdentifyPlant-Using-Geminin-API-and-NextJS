import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'plant';
  const count = parseInt(searchParams.get('count') || '6');
  const page = parseInt(searchParams.get('page') || '1');
  
  try {
    // IMPORTANT: Add your Unsplash API key to .env.local
    const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY;
    
    if (!UNSPLASH_API_KEY) {
      console.warn('⚠️ Unsplash API key not found. Using mock images.');
      
      // Return mock images for development
      const mockImages = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
        id: `mock-${i}`,
        urls: {
          regular: `https://picsum.photos/600/400?random=${i}&plant=${encodeURIComponent(query)}`,
          small: `https://picsum.photos/300/200?random=${i}&plant=${encodeURIComponent(query)}`,
          thumb: `https://picsum.photos/150/100?random=${i}&plant=${encodeURIComponent(query)}`
        },
        alt_description: `${query} plant image ${i + 1}`,
        user: {
          name: 'Botanical Photos',
          username: 'botanical'
        },
        links: {
          html: 'https://unsplash.com'
        }
      }));
      
      return NextResponse.json({
        success: true,
        query,
        count: mockImages.length,
        page,
        total_pages: 1,
        total: mockImages.length,
        images: mockImages,
        note: 'Using mock images. Add UNSPLASH_API_KEY to .env.local for real images.'
      });
    }
    
    // Real Unsplash API call
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&client_id=${UNSPLASH_API_KEY}`,
      {
        headers: {
          'Accept-Version': 'v1'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      query,
      count: data.results.length,
      page,
      total_pages: data.total_pages,
      total: data.total,
      images: data.results.map((photo: any) => ({
        id: photo.id,
        urls: {
          regular: photo.urls.regular,
          small: photo.urls.small,
          thumb: photo.urls.thumb
        },
        alt_description: photo.alt_description || `${query} plant`,
        user: {
          name: photo.user.name,
          username: photo.user.username
        },
        links: {
          html: photo.links.html
        }
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching images:', error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to fetch images",
      message: error instanceof Error ? error.message : "Unknown error",
      query,
      count: 0,
      images: []
    }, { status: 500 });
  }
}