ALTER TABLE "vehicle_feature_defaults"
  ADD COLUMN "custom_features" jsonb DEFAULT '[]'::jsonb NOT NULL;