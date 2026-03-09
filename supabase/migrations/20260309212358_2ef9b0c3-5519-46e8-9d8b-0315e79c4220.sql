-- Remove orphan family_schools entries
DELETE FROM family_schools 
WHERE family_id IN (
  'a1fe7174-ae07-4371-be50-b170b2ce6834',
  '77042fe8-086e-4246-a40b-3fef289144a6',
  '7cab1b8c-0eda-477c-9a28-77aa84e35d9b'
);

-- Remove orphan families (no reps, no students, no names)
DELETE FROM families 
WHERE id IN (
  'a1fe7174-ae07-4371-be50-b170b2ce6834',
  '77042fe8-086e-4246-a40b-3fef289144a6',
  '7cab1b8c-0eda-477c-9a28-77aa84e35d9b'
);