export interface Resume {
  id: number
  name: string
  content?: string
  preview?: string
  is_default: number
  created_at: string
}

export interface Application {
  id: number
  job_title: string
  company: string
  job_url?: string
  job_description?: string
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'
  resume_id?: number
  tailored_resume?: string
  cover_letter?: string
  ats_score?: number
  ats_details?: ATSDetails
  notes?: string
  applied_at?: string
  created_at: string
}

export interface ATSDetails {
  score: number
  matched_keywords: string[]
  missing_keywords: string[]
  recommendations: string[]
}

export interface Settings {
  provider: 'ollama' | 'anthropic'
  ollama_url: string
  ollama_model: string
  anthropic_model: string
  anthropic_api_key: string
}
