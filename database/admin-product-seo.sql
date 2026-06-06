-- Per-product SEO (run once if not using auto-migration on startup)
ALTER TABLE products ADD COLUMN seo_title VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN seo_description VARCHAR(320) NULL;
ALTER TABLE products ADD COLUMN seo_keywords VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN image_alt VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN og_image VARCHAR(500) NULL;
