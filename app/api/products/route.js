import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 * Fetch products with optional filtering
 *
 * Query parameters:
 * - limit: Number of products to return (default: 10)
 * - category: Filter by category slug
 * - activity: Filter by activity name
 * - search: Search in title/description
 * - random: If true, return random products
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const category = searchParams.get('category');
    const activity = searchParams.get('activity');
    const search = searchParams.get('search');
    const random = searchParams.get('random') === 'true';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query
    let query = supabase
      .from('products')
      .select(`
        id,
        asin,
        title,
        brand,
        price,
        currency,
        original_price,
        rating,
        ratings_total,
        main_image_url,
        is_prime,
        affiliate_url,
        category_id,
        product_categories (
          name,
          slug
        )
      `)
      .eq('is_active', true);

    // Apply filters
    if (category) {
      const { data: categoryData } = await supabase
        .from('product_categories')
        .select('id')
        .eq('slug', category)
        .single();

      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      }
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    // Order by rating or random
    if (random) {
      // For random selection, we'll fetch more and shuffle
      query = query.order('rating', { ascending: false, nullsFirst: false }).limit(limit * 3);
    } else {
      query = query.order('rating', { ascending: false, nullsFirst: false }).limit(limit);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // If activity filter, get products linked to that activity
    if (activity) {
      const { data: activityProducts } = await supabase
        .from('activity_products')
        .select('product_id')
        .eq('activity_name', activity);

      if (activityProducts && activityProducts.length > 0) {
        const productIds = activityProducts.map((ap) => ap.product_id);
        const filteredProducts = products.filter((p) => productIds.includes(p.id));
        
        // If we have activity-specific products, use those
        if (filteredProducts.length > 0) {
          const result = random
            ? shuffleArray(filteredProducts).slice(0, limit)
            : filteredProducts.slice(0, limit);
          
          return NextResponse.json({ products: result });
        }
      }
    }

    // Shuffle if random
    const result = random
      ? shuffleArray(products).slice(0, limit)
      : products;

    return NextResponse.json({ products: result });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}