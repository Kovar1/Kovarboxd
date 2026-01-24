-- Enable fuzzy string matching extension for Levenshtein distance
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Test that it works
SELECT levenshtein('test', 'text') as distance;
