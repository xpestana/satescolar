ALTER TABLE public.carnet_config 
ADD COLUMN layout_config jsonb NOT NULL DEFAULT '{
  "headerHeight": 88,
  "photoSize": 56,
  "photoPos": {"x": 50, "y": 15},
  "namePos": {"x": 50, "y": 52},
  "badgePos": {"x": 50, "y": 62},
  "fontSizes": {
    "schoolName": 8,
    "studentName": 9,
    "document": 8
  }
}'::jsonb;