-- Add columns for storing original Amazon content before AI rewriting
-- This allows us to keep the original content for reference while displaying
-- unique, AI-rewritten content to avoid duplicate content penalties in SERPs

-- Add original_title column to store the original Amazon product title
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_title VARCHAR(500);

-- Add original_description column to store the original Amazon product description
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_description TEXT;

-- Add ai_rewritten flag to track which products have been rewritten
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_rewritten BOOLEAN DEFAULT FALSE;

-- Add ai_rewritten_at timestamp to track when the content was rewritten
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_rewritten_at TIMESTAMPTZ;

-- Create index for finding products that haven't been rewritten yet
CREATE INDEX IF NOT EXISTS idx_products_ai_rewritten ON products(ai_rewritten);

-- Comment on columns for documentation
COMMENT ON COLUMN products.original_title IS 'Original product title from Amazon before AI rewriting';
COMMENT ON COLUMN products.original_description IS 'Original product description from Amazon before AI rewriting';
COMMENT ON COLUMN products.ai_rewritten IS 'Flag indicating if the title and description have been rewritten by AI';
COMMENT ON COLUMN products.ai_rewritten_at IS 'Timestamp when the AI rewriting was performed';