-- Create search_histories table for tracking search queries and user feedback
CREATE TABLE search_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  search_type TEXT NOT NULL, -- 'songs', 'venues', 'shows', 'setlists'
  sentiment TEXT, -- 'positive', 'negative'
  feedback_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for performance on search queries
CREATE INDEX idx_search_histories_query ON search_histories(search_query);
CREATE INDEX idx_search_histories_created_at ON search_histories(created_at);
CREATE INDEX idx_search_histories_type ON search_histories(search_type);