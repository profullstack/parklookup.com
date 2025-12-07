-- Products Table for Amazon Affiliate Products
-- This migration creates tables for storing camping gear and outdoor products

-- ============================================
-- Product Categories Table
-- Stores product categories for organization
-- ============================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_id);

-- ============================================
-- Products Table
-- Stores Amazon product data from Rainforest API
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  brand VARCHAR(255),
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  original_price DECIMAL(10, 2),
  rating DECIMAL(3, 2),
  ratings_total INTEGER DEFAULT 0,
  reviews_total INTEGER DEFAULT 0,
  main_image_url TEXT,
  images JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  specifications JSONB DEFAULT '{}',
  availability VARCHAR(100),
  is_prime BOOLEAN DEFAULT FALSE,
  affiliate_url TEXT,
  search_term VARCHAR(255),
  raw_data JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for product lookups
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_search_term ON products(search_term);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);

-- Create full-text search index for products
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(brand, ''))
);

-- ============================================
-- Park Products Junction Table
-- Links products to parks for recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS park_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nps_park_id UUID REFERENCES nps_parks(id) ON DELETE CASCADE,
  wikidata_park_id UUID REFERENCES wikidata_parks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relevance_score DECIMAL(5, 4) DEFAULT 1.0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT park_product_check CHECK (nps_park_id IS NOT NULL OR wikidata_park_id IS NOT NULL)
);

-- Create indexes for park products lookups
CREATE INDEX IF NOT EXISTS idx_park_products_nps ON park_products(nps_park_id);
CREATE INDEX IF NOT EXISTS idx_park_products_wikidata ON park_products(wikidata_park_id);
CREATE INDEX IF NOT EXISTS idx_park_products_product ON park_products(product_id);

-- ============================================
-- Activity Products Junction Table
-- Links products to activities
-- ============================================
CREATE TABLE IF NOT EXISTS activity_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_name VARCHAR(100) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relevance_score DECIMAL(5, 4) DEFAULT 1.0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_name, product_id)
);

-- Create indexes for activity products lookups
CREATE INDEX IF NOT EXISTS idx_activity_products_activity ON activity_products(activity_name);
CREATE INDEX IF NOT EXISTS idx_activity_products_product ON activity_products(product_id);

-- ============================================
-- Product Import Logs Table
-- Tracks product import history
-- ============================================
CREATE TABLE IF NOT EXISTS product_import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_term VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
  products_fetched INTEGER DEFAULT 0,
  products_inserted INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create index for product import log queries
CREATE INDEX IF NOT EXISTS idx_product_import_logs_search_term ON product_import_logs(search_term);
CREATE INDEX IF NOT EXISTS idx_product_import_logs_status ON product_import_logs(status);
CREATE INDEX IF NOT EXISTS idx_product_import_logs_started_at ON product_import_logs(started_at DESC);

-- ============================================
-- Triggers
-- ============================================

-- Triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for products data
CREATE POLICY "Product categories are viewable by everyone"
  ON product_categories FOR SELECT
  USING (true);

CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Park products are viewable by everyone"
  ON park_products FOR SELECT
  USING (true);

CREATE POLICY "Activity products are viewable by everyone"
  ON activity_products FOR SELECT
  USING (true);

-- Service role policies for data import
CREATE POLICY "Service role can manage product categories"
  ON product_categories FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage park products"
  ON park_products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage activity products"
  ON activity_products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Product import logs are only accessible by service role"
  ON product_import_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Seed Data: Product Categories
-- ============================================
INSERT INTO product_categories (name, slug, description, display_order) VALUES
  ('Camping Gear', 'camping-gear', 'Essential camping equipment and supplies', 1),
  ('Hiking Equipment', 'hiking-equipment', 'Gear for hiking and backpacking', 2),
  ('Outdoor Clothing', 'outdoor-clothing', 'Weather-appropriate outdoor apparel', 3),
  ('Tents & Shelters', 'tents-shelters', 'Tents, tarps, and camping shelters', 4),
  ('Sleeping Gear', 'sleeping-gear', 'Sleeping bags, pads, and accessories', 5),
  ('Cooking & Food', 'cooking-food', 'Camp cooking equipment and food storage', 6),
  ('Lighting', 'lighting', 'Flashlights, lanterns, and headlamps', 7),
  ('Navigation', 'navigation', 'Maps, compasses, and GPS devices', 8),
  ('Safety & First Aid', 'safety-first-aid', 'First aid kits and safety equipment', 9),
  ('Water & Hydration', 'water-hydration', 'Water bottles, filters, and hydration packs', 10),
  ('Backpacks & Bags', 'backpacks-bags', 'Backpacks, daypacks, and duffel bags', 11),
  ('Footwear', 'footwear', 'Hiking boots, trail shoes, and sandals', 12),
  ('Wildlife Watching', 'wildlife-watching', 'Binoculars, cameras, and field guides', 13),
  ('Fishing Gear', 'fishing-gear', 'Fishing rods, tackle, and accessories', 14),
  ('Winter Sports', 'winter-sports', 'Snowshoes, skis, and cold weather gear', 15)
ON CONFLICT (slug) DO NOTHING;