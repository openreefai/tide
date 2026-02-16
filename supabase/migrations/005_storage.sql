-- Create private tarballs bucket
-- No public access. All reads/writes go through service-role client in API routes.
INSERT INTO storage.buckets (id, name, public) VALUES ('tarballs', 'tarballs', false)
ON CONFLICT (id) DO NOTHING;
