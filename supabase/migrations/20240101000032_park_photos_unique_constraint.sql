-- Add unique constraint on park_photos for upsert operations
-- This allows the import script to use ON CONFLICT for deduplication

-- Add unique constraint on (park_id, image_url)
ALTER TABLE park_photos 
ADD CONSTRAINT park_photos_park_id_image_url_unique 
UNIQUE (park_id, image_url);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT park_photos_park_id_image_url_unique ON park_photos IS 
'Ensures each image URL is unique per park, enabling upsert operations during photo imports';