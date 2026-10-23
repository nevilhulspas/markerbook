export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      annotations: {
        Row: {
          body: string | null
          created_at: string
          date: string
          end_date: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          date: string
          end_date?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          date?: string
          end_date?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      biomarker_descriptions: {
        Row: {
          biomarker_id: string
          content: string
          content_hash: string
          created_at: string
          id: string
          model: string
          updated_at: string
        }
        Insert: {
          biomarker_id: string
          content: string
          content_hash: string
          created_at?: string
          id?: string
          model: string
          updated_at?: string
        }
        Update: {
          biomarker_id?: string
          content?: string
          content_hash?: string
          created_at?: string
          id?: string
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_descriptions_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: true
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_favorites: {
        Row: {
          biomarker_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          biomarker_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          biomarker_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_favorites_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_units: {
        Row: {
          biomarker_id: string
          conversion_factor: number
          created_at: string
          id: string
          is_default: boolean
          unit: string
        }
        Insert: {
          biomarker_id: string
          conversion_factor?: number
          created_at?: string
          id?: string
          is_default?: boolean
          unit: string
        }
        Update: {
          biomarker_id?: string
          conversion_factor?: number
          created_at?: string
          id?: string
          is_default?: boolean
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_units_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarkers: {
        Row: {
          aliases: string[]
          archived_at: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_custom: boolean
          loinc_code: string | null
          molar_mass: number | null
          typical_mass_unit: string | null
          typical_molar_unit: string | null
          valence: number | null
          method: string | null
          name: string
          panel_id: string | null
          parent_id: string | null
          range_source: string | null
          ref_range_high: number | null
          ref_range_high_female: number | null
          ref_range_high_male: number | null
          ref_range_low: number | null
          ref_range_low_female: number | null
          ref_range_low_male: number | null
          short_name: string | null
          unit: string
          variant_name: string | null
        }
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean
          loinc_code?: string | null
          molar_mass?: number | null
          typical_mass_unit?: string | null
          typical_molar_unit?: string | null
          valence?: number | null
          method?: string | null
          name: string
          panel_id?: string | null
          parent_id?: string | null
          range_source?: string | null
          ref_range_high?: number | null
          ref_range_high_female?: number | null
          ref_range_high_male?: number | null
          ref_range_low?: number | null
          ref_range_low_female?: number | null
          ref_range_low_male?: number | null
          short_name?: string | null
          unit: string
          variant_name?: string | null
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean
          loinc_code?: string | null
          molar_mass?: number | null
          typical_mass_unit?: string | null
          typical_molar_unit?: string | null
          valence?: number | null
          method?: string | null
          name?: string
          panel_id?: string | null
          parent_id?: string | null
          range_source?: string | null
          ref_range_high?: number | null
          ref_range_high_female?: number | null
          ref_range_high_male?: number | null
          ref_range_low?: number | null
          ref_range_low_female?: number | null
          ref_range_low_male?: number | null
          short_name?: string | null
          unit?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biomarkers_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomarkers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_tests: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          pdf_storage_path: string | null
          sample_type: string
          test_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pdf_storage_path?: string | null
          sample_type?: string
          test_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pdf_storage_path?: string | null
          sample_type?: string
          test_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_goals: {
        Row: {
          id: string
          metric: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          metric: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          metric?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_log_entries: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          logged_on: string
          notes: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_on: string
          notes?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_on?: string
          notes?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      chat_document_extractions: {
        Row: {
          created_at: string
          document_type: string
          extraction: Json
          id: string
          storage_path: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          extraction: Json
          id?: string
          storage_path: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          extraction?: Json
          id?: string
          storage_path?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_document_extractions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_memory_files: {
        Row: {
          content: string
          id: string
          path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          id?: string
          path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          id?: string
          path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          tool_invocations: Json | null
        }
        Insert: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          tool_invocations?: Json | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          tool_invocations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clinvar_cache: {
        Row: {
          clinical_significance: string | null
          conditions: string | null
          fetched_at: string
          gene_name: string | null
          review_status: string | null
          rsid: string
          variant_name: string | null
        }
        Insert: {
          clinical_significance?: string | null
          conditions?: string | null
          fetched_at?: string
          gene_name?: string | null
          review_status?: string | null
          rsid: string
          variant_name?: string | null
        }
        Update: {
          clinical_significance?: string | null
          conditions?: string | null
          fetched_at?: string
          gene_name?: string | null
          review_status?: string | null
          rsid?: string
          variant_name?: string | null
        }
        Relationships: []
      }
      custom_foods: {
        Row: {
          brand: string | null
          carbs_per_100g: number | null
          created_at: string
          default_grams: number
          fat_per_100g: number | null
          fiber_per_100g: number | null
          id: string
          is_deleted: boolean
          kcal_per_100g: number | null
          name: string
          notes: string | null
          protein_per_100g: number | null
          sat_fat_per_100g: number | null
          sodium_mg_per_100g: number | null
          sugar_per_100g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          carbs_per_100g?: number | null
          created_at?: string
          default_grams?: number
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          is_deleted?: boolean
          kcal_per_100g?: number | null
          name: string
          notes?: string | null
          protein_per_100g?: number | null
          sat_fat_per_100g?: number | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          carbs_per_100g?: number | null
          created_at?: string
          default_grams?: number
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          is_deleted?: boolean
          kcal_per_100g?: number | null
          name?: string
          notes?: string | null
          protein_per_100g?: number | null
          sat_fat_per_100g?: number | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dexa_regions: {
        Row: {
          bmc_g: number | null
          bmd: number | null
          fat_mass_g: number | null
          fat_pct: number | null
          id: string
          lean_mass_g: number | null
          region: string
          scan_id: string
          t_score: number | null
          total_mass_g: number | null
          z_score: number | null
        }
        Insert: {
          bmc_g?: number | null
          bmd?: number | null
          fat_mass_g?: number | null
          fat_pct?: number | null
          id?: string
          lean_mass_g?: number | null
          region: string
          scan_id: string
          t_score?: number | null
          total_mass_g?: number | null
          z_score?: number | null
        }
        Update: {
          bmc_g?: number | null
          bmd?: number | null
          fat_mass_g?: number | null
          fat_pct?: number | null
          id?: string
          lean_mass_g?: number | null
          region?: string
          scan_id?: string
          t_score?: number | null
          total_mass_g?: number | null
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dexa_regions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "dexa_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      dexa_scans: {
        Row: {
          age_years: number | null
          almi: number | null
          android_fat_pct: number | null
          android_gynoid_ratio: number | null
          bmc_g: number | null
          body_fat_pct: number | null
          bone_t_score: number | null
          bone_z_score: number | null
          created_at: string
          fat_mass_g: number | null
          ffmi: number | null
          gynoid_fat_pct: number | null
          height_cm: number | null
          id: string
          lean_mass_g: number | null
          notes: string | null
          pdf_storage_path: string | null
          provider: string | null
          scan_date: string
          source: string
          total_bmd: number | null
          total_mass_kg: number | null
          updated_at: string
          user_id: string
          visceral_fat_g: number | null
          weight_kg: number | null
        }
        Insert: {
          age_years?: number | null
          almi?: number | null
          android_fat_pct?: number | null
          android_gynoid_ratio?: number | null
          bmc_g?: number | null
          body_fat_pct?: number | null
          bone_t_score?: number | null
          bone_z_score?: number | null
          created_at?: string
          fat_mass_g?: number | null
          ffmi?: number | null
          gynoid_fat_pct?: number | null
          height_cm?: number | null
          id?: string
          lean_mass_g?: number | null
          notes?: string | null
          pdf_storage_path?: string | null
          provider?: string | null
          scan_date: string
          source?: string
          total_bmd?: number | null
          total_mass_kg?: number | null
          updated_at?: string
          user_id: string
          visceral_fat_g?: number | null
          weight_kg?: number | null
        }
        Update: {
          age_years?: number | null
          almi?: number | null
          android_fat_pct?: number | null
          android_gynoid_ratio?: number | null
          bmc_g?: number | null
          body_fat_pct?: number | null
          bone_t_score?: number | null
          bone_z_score?: number | null
          created_at?: string
          fat_mass_g?: number | null
          ffmi?: number | null
          gynoid_fat_pct?: number | null
          height_cm?: number | null
          id?: string
          lean_mass_g?: number | null
          notes?: string | null
          pdf_storage_path?: string | null
          provider?: string | null
          scan_date?: string
          source?: string
          total_bmd?: number | null
          total_mass_kg?: number | null
          updated_at?: string
          user_id?: string
          visceral_fat_g?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      dutch_computed_values: {
        Row: {
          created_at: string
          dutch_test_id: string
          formula: string | null
          id: string
          name: string
          source_marker_ids: string[] | null
          unit: string
          value: number
        }
        Insert: {
          created_at?: string
          dutch_test_id: string
          formula?: string | null
          id?: string
          name: string
          source_marker_ids?: string[] | null
          unit: string
          value: number
        }
        Update: {
          created_at?: string
          dutch_test_id?: string
          formula?: string | null
          id?: string
          name?: string
          source_marker_ids?: string[] | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dutch_computed_values_dutch_test_id_fkey"
            columns: ["dutch_test_id"]
            isOneToOne: false
            referencedRelation: "dutch_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      dutch_marker_descriptions: {
        Row: {
          biomarker_id: string
          content: string
          content_hash: string
          created_at: string
          id: string
          model: string
          updated_at: string
        }
        Insert: {
          biomarker_id: string
          content: string
          content_hash: string
          created_at?: string
          id?: string
          model: string
          updated_at?: string
        }
        Update: {
          biomarker_id?: string
          content?: string
          content_hash?: string
          created_at?: string
          id?: string
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dutch_marker_descriptions_marker_fkey"
            columns: ["biomarker_id"]
            isOneToOne: true
            referencedRelation: "dutch_markers"
            referencedColumns: ["id"]
          },
        ]
      }
      dutch_marker_units: {
        Row: {
          biomarker_id: string
          conversion_factor: number
          created_at: string
          id: string
          is_default: boolean
          unit: string
        }
        Insert: {
          biomarker_id: string
          conversion_factor?: number
          created_at?: string
          id?: string
          is_default?: boolean
          unit: string
        }
        Update: {
          biomarker_id?: string
          conversion_factor?: number
          created_at?: string
          id?: string
          is_default?: boolean
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "dutch_marker_units_marker_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "dutch_markers"
            referencedColumns: ["id"]
          },
        ]
      }
      dutch_markers: {
        Row: {
          aliases: string[]
          archived_at: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          loinc_code: string | null
          method: string | null
          name: string
          panel_id: string | null
          parent_id: string | null
          ref_range_high: number | null
          ref_range_high_female: number | null
          ref_range_high_male: number | null
          ref_range_low: number | null
          ref_range_low_female: number | null
          ref_range_low_male: number | null
          short_name: string | null
          unit: string
          variant_name: string | null
        }
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          loinc_code?: string | null
          method?: string | null
          name: string
          panel_id?: string | null
          parent_id?: string | null
          ref_range_high?: number | null
          ref_range_high_female?: number | null
          ref_range_high_male?: number | null
          ref_range_low?: number | null
          ref_range_low_female?: number | null
          ref_range_low_male?: number | null
          short_name?: string | null
          unit: string
          variant_name?: string | null
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          loinc_code?: string | null
          method?: string | null
          name?: string
          panel_id?: string | null
          parent_id?: string | null
          ref_range_high?: number | null
          ref_range_high_female?: number | null
          ref_range_high_male?: number | null
          ref_range_low?: number | null
          ref_range_low_female?: number | null
          ref_range_low_male?: number | null
          short_name?: string | null
          unit?: string
          variant_name?: string | null
        }
        Relationships: []
      }
      dutch_reference_ranges: {
        Row: {
          age_max: number | null
          age_min: number | null
          biomarker_id: string
          created_at: string
          id: string
          phase: string | null
          range_high: number | null
          range_low: number | null
          range_type: string
          sex: string | null
          source: string | null
          source_url: string | null
          unit: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          biomarker_id: string
          created_at?: string
          id?: string
          phase?: string | null
          range_high?: number | null
          range_low?: number | null
          range_type?: string
          sex?: string | null
          source?: string | null
          source_url?: string | null
          unit: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          biomarker_id?: string
          created_at?: string
          id?: string
          phase?: string | null
          range_high?: number | null
          range_low?: number | null
          range_type?: string
          sex?: string | null
          source?: string | null
          source_url?: string | null
          unit?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dutch_reference_ranges_marker_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "dutch_markers"
            referencedColumns: ["id"]
          },
        ]
      }
      dutch_test_results: {
        Row: {
          biomarker_id: string
          created_at: string
          dutch_test_id: string
          id: string
          timepoint: string | null
          unit: string
          value: number
        }
        Insert: {
          biomarker_id: string
          created_at?: string
          dutch_test_id: string
          id?: string
          timepoint?: string | null
          unit: string
          value: number
        }
        Update: {
          biomarker_id?: string
          created_at?: string
          dutch_test_id?: string
          id?: string
          timepoint?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dutch_test_results_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "dutch_markers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dutch_test_results_dutch_test_id_fkey"
            columns: ["dutch_test_id"]
            isOneToOne: false
            referencedRelation: "dutch_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      dutch_tests: {
        Row: {
          created_at: string
          cycle_day: number | null
          id: string
          menstrual_phase: string | null
          name: string
          notes: string | null
          pdf_storage_path: string | null
          test_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_day?: number | null
          id?: string
          menstrual_phase?: string | null
          name: string
          notes?: string | null
          pdf_storage_path?: string | null
          test_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_day?: number | null
          id?: string
          menstrual_phase?: string | null
          name?: string
          notes?: string | null
          pdf_storage_path?: string | null
          test_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          custom_food_id: string | null
          entry_date: string
          fat_g: number | null
          fiber_g: number | null
          food_name: string
          grams: number | null
          id: string
          image_path: string | null
          is_deleted: boolean
          match_ref: string | null
          match_source: string | null
          meal_type: string | null
          notes: string | null
          protein_g: number | null
          raw_input: string | null
          recipe_id: string | null
          saturated_fat_g: number | null
          sodium_mg: number | null
          source: string
          submission_id: string | null
          sugar_g: number | null
          updated_at: string
          user_id: string
          weight_estimated: boolean
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          custom_food_id?: string | null
          entry_date: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name: string
          grams?: number | null
          id?: string
          image_path?: string | null
          is_deleted?: boolean
          match_ref?: string | null
          match_source?: string | null
          meal_type?: string | null
          notes?: string | null
          protein_g?: number | null
          raw_input?: string | null
          recipe_id?: string | null
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          source?: string
          submission_id?: string | null
          sugar_g?: number | null
          updated_at?: string
          user_id: string
          weight_estimated?: boolean
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          custom_food_id?: string | null
          entry_date?: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string
          grams?: number | null
          id?: string
          image_path?: string | null
          is_deleted?: boolean
          match_ref?: string | null
          match_source?: string | null
          meal_type?: string | null
          notes?: string | null
          protein_g?: number | null
          raw_input?: string | null
          recipe_id?: string | null
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          source?: string
          submission_id?: string | null
          sugar_g?: number | null
          updated_at?: string
          user_id?: string
          weight_estimated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_custom_food_id_fkey"
            columns: ["custom_food_id"]
            isOneToOne: false
            referencedRelation: "custom_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      genetic_profiles: {
        Row: {
          created_at: string
          file_storage_path: string | null
          id: string
          import_date: string
          snp_count: number
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_storage_path?: string | null
          id?: string
          import_date?: string
          snp_count?: number
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_storage_path?: string | null
          id?: string
          import_date?: string
          snp_count?: number
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          id: string
          started_at: string
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          target_user_id?: string
        }
        Relationships: []
      }
      interpretations: {
        Row: {
          blood_test_id: string
          content: string
          created_at: string
          id: string
          marker_context_hash: string
          model: string
          profile_hash: string
          test_result_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          blood_test_id: string
          content: string
          created_at?: string
          id?: string
          marker_context_hash: string
          model: string
          profile_hash: string
          test_result_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          blood_test_id?: string
          content?: string
          created_at?: string
          id?: string
          marker_context_hash?: string
          model?: string
          profile_hash?: string
          test_result_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interpretations_blood_test_id_fkey"
            columns: ["blood_test_id"]
            isOneToOne: false
            referencedRelation: "blood_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_favorites: {
        Row: {
          created_at: string
          id: string
          lab_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lab_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_favorites_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_biomarkers: {
        Row: {
          biomarker_id: string
          lab_test_id: string
        }
        Insert: {
          biomarker_id: string
          lab_test_id: string
        }
        Update: {
          biomarker_id?: string
          lab_test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_biomarkers_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_biomarkers_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          cost: number | null
          created_at: string
          currency: string | null
          id: string
          lab_id: string
          method: string | null
          name: string
          notes: string | null
          provider: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_type: string | null
          status: string
          submitted_by: string | null
          turnaround_days: number | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          lab_id: string
          method?: string | null
          name: string
          notes?: string | null
          provider?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_type?: string | null
          status?: string
          submitted_by?: string | null
          turnaround_days?: number | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          lab_id?: string
          method?: string | null
          name?: string
          notes?: string | null
          provider?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_type?: string | null
          status?: string
          submitted_by?: string | null
          turnaround_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_tests_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      loinc_display: {
        Row: {
          abbreviation: string | null
          clean_name: string | null
          generated_at: string
          loinc_num: string
          model: string | null
        }
        Insert: {
          abbreviation?: string | null
          clean_name?: string | null
          generated_at?: string
          loinc_num: string
          model?: string | null
        }
        Update: {
          abbreviation?: string | null
          clean_name?: string | null
          generated_at?: string
          loinc_num?: string
          model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loinc_display_loinc_num_fkey"
            columns: ["loinc_num"]
            isOneToOne: true
            referencedRelation: "loinc_terms"
            referencedColumns: ["loinc_num"]
          },
        ]
      }
      loinc_analyte_codes: {
        Row: {
          loinc_code: string
          part_number: string
        }
        Insert: {
          loinc_code: string
          part_number: string
        }
        Update: {
          loinc_code?: string
          part_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "loinc_analyte_codes_part_number_fkey"
            columns: ["part_number"]
            isOneToOne: false
            referencedRelation: "loinc_analytes"
            referencedColumns: ["part_number"]
          },
        ]
      }
      loinc_analytes: {
        Row: {
          mass_unit: string | null
          molar_mass: number
          molar_unit: string | null
          name: string
          part_number: string
          source: string
          valence: number | null
        }
        Insert: {
          mass_unit?: string | null
          molar_mass: number
          molar_unit?: string | null
          name: string
          part_number: string
          source: string
          valence?: number | null
        }
        Update: {
          mass_unit?: string | null
          molar_mass?: number
          molar_unit?: string | null
          name?: string
          part_number?: string
          source?: string
          valence?: number | null
        }
        Relationships: []
      }
      loinc_terms: {
        Row: {
          class: string | null
          classtype: number | null
          component: string | null
          example_ucum_units: string | null
          loinc_num: string
          long_common_name: string | null
          method_typ: string | null
          property: string | null
          scale_typ: string | null
          short_name: string | null
          status: string | null
          system: string | null
          time_aspct: string | null
          version_last_changed: string | null
        }
        Insert: {
          class?: string | null
          classtype?: number | null
          component?: string | null
          example_ucum_units?: string | null
          loinc_num: string
          long_common_name?: string | null
          method_typ?: string | null
          property?: string | null
          scale_typ?: string | null
          short_name?: string | null
          status?: string | null
          system?: string | null
          time_aspct?: string | null
          version_last_changed?: string | null
        }
        Update: {
          class?: string | null
          classtype?: number | null
          component?: string | null
          example_ucum_units?: string | null
          loinc_num?: string
          long_common_name?: string | null
          method_typ?: string | null
          property?: string | null
          scale_typ?: string | null
          short_name?: string | null
          status?: string | null
          system?: string | null
          time_aspct?: string | null
          version_last_changed?: string | null
        }
        Relationships: []
      }
      marker_suggestions: {
        Row: {
          category: string | null
          created_at: string
          created_biomarker_id: string | null
          details: string | null
          id: string
          name: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_biomarker_id?: string | null
          details?: string | null
          id?: string
          name: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_biomarker_id?: string | null
          details?: string | null
          id?: string
          name?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marker_suggestions_created_biomarker_id_fkey"
            columns: ["created_biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_conditions: {
        Row: {
          condition_name: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      microbiome_results: {
        Row: {
          created_at: string
          id: string
          microbiome_test_id: string
          raw_label: string | null
          ref_high: number | null
          ref_low: number | null
          status: string | null
          taxon_id: string
          unit: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          microbiome_test_id: string
          raw_label?: string | null
          ref_high?: number | null
          ref_low?: number | null
          status?: string | null
          taxon_id: string
          unit?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          microbiome_test_id?: string
          raw_label?: string | null
          ref_high?: number | null
          ref_low?: number | null
          status?: string | null
          taxon_id?: string
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "microbiome_results_microbiome_test_id_fkey"
            columns: ["microbiome_test_id"]
            isOneToOne: false
            referencedRelation: "microbiome_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microbiome_results_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: false
            referencedRelation: "microbiome_taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      microbiome_scores: {
        Row: {
          created_at: string
          description: string | null
          id: string
          microbiome_test_id: string
          name: string
          ref_high: number | null
          ref_low: number | null
          status: string | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          microbiome_test_id: string
          name: string
          ref_high?: number | null
          ref_low?: number | null
          status?: string | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          microbiome_test_id?: string
          name?: string
          ref_high?: number | null
          ref_low?: number | null
          status?: string | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "microbiome_scores_microbiome_test_id_fkey"
            columns: ["microbiome_test_id"]
            isOneToOne: false
            referencedRelation: "microbiome_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      microbiome_taxa: {
        Row: {
          aliases: string[]
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          rank: string
        }
        Insert: {
          aliases?: string[]
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          rank: string
        }
        Update: {
          aliases?: string[]
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          rank?: string
        }
        Relationships: [
          {
            foreignKeyName: "microbiome_taxa_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "microbiome_taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      microbiome_tests: {
        Row: {
          created_at: string
          id: string
          lab_name: string | null
          name: string
          notes: string | null
          pdf_storage_path: string | null
          sample_type: string | null
          test_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab_name?: string | null
          name: string
          notes?: string | null
          pdf_storage_path?: string | null
          sample_type?: string | null
          test_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lab_name?: string | null
          name?: string
          notes?: string | null
          pdf_storage_path?: string | null
          sample_type?: string | null
          test_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nevo_foods: {
        Row: {
          carbs_per_100g: number | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          food_group_en: string | null
          food_group_nl: string | null
          kcal_per_100g: number | null
          name_en: string | null
          name_nl: string
          nevo_code: string
          protein_per_100g: number | null
          sat_fat_per_100g: number | null
          search_text: string | null
          sodium_mg_per_100g: number | null
          sugar_per_100g: number | null
          synonyms: string | null
        }
        Insert: {
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          food_group_en?: string | null
          food_group_nl?: string | null
          kcal_per_100g?: number | null
          name_en?: string | null
          name_nl: string
          nevo_code: string
          protein_per_100g?: number | null
          sat_fat_per_100g?: number | null
          search_text?: string | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
          synonyms?: string | null
        }
        Update: {
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          food_group_en?: string | null
          food_group_nl?: string | null
          kcal_per_100g?: number | null
          name_en?: string | null
          name_nl?: string
          nevo_code?: string
          protein_per_100g?: number | null
          sat_fat_per_100g?: number | null
          search_text?: string | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
          synonyms?: string | null
        }
        Relationships: []
      }
      next_to_test: {
        Row: {
          biomarker_id: string | null
          created_at: string
          custom_name: string | null
          due_date: string | null
          id: string
          lab_test_id: string | null
          list_id: string
          note: string | null
          status: string
          test_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          biomarker_id?: string | null
          created_at?: string
          custom_name?: string | null
          due_date?: string | null
          id?: string
          lab_test_id?: string | null
          list_id: string
          note?: string | null
          status?: string
          test_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          biomarker_id?: string | null
          created_at?: string
          custom_name?: string | null
          due_date?: string | null
          id?: string
          lab_test_id?: string | null
          list_id?: string
          note?: string | null
          status?: string
          test_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_to_test_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_to_test_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_to_test_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "next_to_test_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      next_to_test_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      other_test_values: {
        Row: {
          flag: string | null
          id: string
          label: string
          sort_order: number
          test_id: string
          unit: string | null
          value: string | null
        }
        Insert: {
          flag?: string | null
          id?: string
          label: string
          sort_order?: number
          test_id: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          flag?: string | null
          id?: string
          label?: string
          sort_order?: number
          test_id?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_test_values_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "other_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      other_tests: {
        Row: {
          created_at: string
          id: string
          interpretation: string | null
          interpreted_at: string | null
          notes: string | null
          outcome: string
          pdf_storage_path: string | null
          provider: string | null
          result_summary: string | null
          source: string
          test_date: string
          test_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interpretation?: string | null
          interpreted_at?: string | null
          notes?: string | null
          outcome?: string
          pdf_storage_path?: string | null
          provider?: string | null
          result_summary?: string | null
          source?: string
          test_date: string
          test_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interpretation?: string | null
          interpreted_at?: string | null
          notes?: string | null
          outcome?: string
          pdf_storage_path?: string | null
          provider?: string | null
          result_summary?: string | null
          source?: string
          test_date?: string
          test_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      panels: {
        Row: {
          created_at: string
          display_order: number
          id: string
          loinc_code: string | null
          name: string
          short_name: string | null
          system_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          loinc_code?: string | null
          name: string
          short_name?: string | null
          system_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          loinc_code?: string | null
          name?: string
          short_name?: string | null
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panels_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          alcohol_drinks_per_week: number | null
          born_via_csection: boolean | null
          breastfed_as_infant: boolean | null
          created_at: string
          date_of_birth: string | null
          diet_pattern: string | null
          display_name: string | null
          extra_notes: string | null
          family_history: string | null
          height_cm: number | null
          id: string
          impersonatable: boolean
          known_allergies: string | null
          nutrition_calorie_target: number | null
          nutrition_carbs_target_g: number | null
          nutrition_fat_target_g: number | null
          nutrition_log_token: string | null
          nutrition_protein_target_g: number | null
          pregnancy_status: string | null
          sex: string | null
          smoking_status: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          alcohol_drinks_per_week?: number | null
          born_via_csection?: boolean | null
          breastfed_as_infant?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          diet_pattern?: string | null
          display_name?: string | null
          extra_notes?: string | null
          family_history?: string | null
          height_cm?: number | null
          id: string
          impersonatable?: boolean
          known_allergies?: string | null
          nutrition_calorie_target?: number | null
          nutrition_carbs_target_g?: number | null
          nutrition_fat_target_g?: number | null
          nutrition_log_token?: string | null
          nutrition_protein_target_g?: number | null
          pregnancy_status?: string | null
          sex?: string | null
          smoking_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          alcohol_drinks_per_week?: number | null
          born_via_csection?: boolean | null
          breastfed_as_infant?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          diet_pattern?: string | null
          display_name?: string | null
          extra_notes?: string | null
          family_history?: string | null
          height_cm?: number | null
          id?: string
          impersonatable?: boolean
          known_allergies?: string | null
          nutrition_calorie_target?: number | null
          nutrition_carbs_target_g?: number | null
          nutrition_fat_target_g?: number | null
          nutrition_log_token?: string | null
          nutrition_protein_target_g?: number | null
          pregnancy_status?: string | null
          sex?: string | null
          smoking_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          carbs_per_100g: number | null
          custom_food_id: string | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          grams: number
          id: string
          kcal_per_100g: number | null
          nevo_code: string | null
          off_barcode: string | null
          position: number
          protein_per_100g: number | null
          raw_name: string | null
          recipe_id: string
          sat_fat_per_100g: number | null
          sodium_mg_per_100g: number | null
          sugar_per_100g: number | null
        }
        Insert: {
          carbs_per_100g?: number | null
          custom_food_id?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          grams: number
          id?: string
          kcal_per_100g?: number | null
          nevo_code?: string | null
          off_barcode?: string | null
          position?: number
          protein_per_100g?: number | null
          raw_name?: string | null
          recipe_id: string
          sat_fat_per_100g?: number | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
        }
        Update: {
          carbs_per_100g?: number | null
          custom_food_id?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          grams?: number
          id?: string
          kcal_per_100g?: number | null
          nevo_code?: string | null
          off_barcode?: string | null
          position?: number
          protein_per_100g?: number | null
          raw_name?: string | null
          recipe_id?: string
          sat_fat_per_100g?: number | null
          sodium_mg_per_100g?: number | null
          sugar_per_100g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_custom_food_id_fkey"
            columns: ["custom_food_id"]
            isOneToOne: false
            referencedRelation: "custom_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          name: string
          notes: string | null
          total_carbs: number
          total_fat: number
          total_fiber: number
          total_grams: number
          total_kcal: number
          total_protein: number
          total_sat_fat: number
          total_sodium_mg: number
          total_sugar: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name: string
          notes?: string | null
          total_carbs?: number
          total_fat?: number
          total_fiber?: number
          total_grams?: number
          total_kcal?: number
          total_protein?: number
          total_sat_fat?: number
          total_sodium_mg?: number
          total_sugar?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name?: string
          notes?: string | null
          total_carbs?: number
          total_fat?: number
          total_fiber?: number
          total_grams?: number
          total_kcal?: number
          total_protein?: number
          total_sat_fat?: number
          total_sodium_mg?: number
          total_sugar?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reference_ranges: {
        Row: {
          age_max: number | null
          age_min: number | null
          biomarker_id: string
          created_at: string
          id: string
          phase: string | null
          range_high: number | null
          range_low: number | null
          range_type: string
          sex: string
          source: string
          source_url: string | null
          unit: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          biomarker_id: string
          created_at?: string
          id?: string
          phase?: string | null
          range_high?: number | null
          range_low?: number | null
          range_type?: string
          sex: string
          source?: string
          source_url?: string | null
          unit: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          biomarker_id?: string
          created_at?: string
          id?: string
          phase?: string | null
          range_high?: number | null
          range_low?: number | null
          range_type?: string
          sex?: string
          source?: string
          source_url?: string | null
          unit?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_ranges_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      rmr_tests: {
        Row: {
          created_at: string
          fuel_carb_pct: number | null
          fuel_fat_pct: number | null
          id: string
          notes: string | null
          pdf_storage_path: string | null
          predicted_rmr_kcal: number | null
          provider: string | null
          rer: number | null
          rmr_kcal: number
          source: string
          test_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fuel_carb_pct?: number | null
          fuel_fat_pct?: number | null
          id?: string
          notes?: string | null
          pdf_storage_path?: string | null
          predicted_rmr_kcal?: number | null
          provider?: string | null
          rer?: number | null
          rmr_kcal: number
          source?: string
          test_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fuel_carb_pct?: number | null
          fuel_fat_pct?: number | null
          id?: string
          notes?: string | null
          pdf_storage_path?: string | null
          predicted_rmr_kcal?: number | null
          provider?: string | null
          rer?: number | null
          rmr_kcal?: number
          source?: string
          test_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rna_expressions: {
        Row: {
          created_at: string
          expression_value: number | null
          fold_change: number | null
          gene_name: string
          id: string
          p_value: number | null
          rna_test_id: string
          status: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          expression_value?: number | null
          fold_change?: number | null
          gene_name: string
          id?: string
          p_value?: number | null
          rna_test_id: string
          status?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          expression_value?: number | null
          fold_change?: number | null
          gene_name?: string
          id?: string
          p_value?: number | null
          rna_test_id?: string
          status?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rna_expressions_rna_test_id_fkey"
            columns: ["rna_test_id"]
            isOneToOne: false
            referencedRelation: "rna_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      rna_tests: {
        Row: {
          created_at: string
          file_storage_path: string | null
          id: string
          name: string
          source: string | null
          test_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_storage_path?: string | null
          id?: string
          name: string
          source?: string | null
          test_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_storage_path?: string | null
          id?: string
          name?: string
          source?: string | null
          test_date?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          inserted: number
          lab_id: string
          logs: string
          profile_updated: boolean
          skipped: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          inserted?: number
          lab_id: string
          logs?: string
          profile_updated?: boolean
          skipped?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          inserted?: number
          lab_id?: string
          logs?: string
          profile_updated?: boolean
          skipped?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_variants: {
        Row: {
          category: string | null
          chromosome: string | null
          clinical_significance: string | null
          created_at: string
          gene_name: string | null
          genetic_profile_id: string
          genotype: string
          id: string
          position: number | null
          rsid: string
          variant_name: string | null
        }
        Insert: {
          category?: string | null
          chromosome?: string | null
          clinical_significance?: string | null
          created_at?: string
          gene_name?: string | null
          genetic_profile_id: string
          genotype: string
          id?: string
          position?: number | null
          rsid: string
          variant_name?: string | null
        }
        Update: {
          category?: string | null
          chromosome?: string | null
          clinical_significance?: string | null
          created_at?: string
          gene_name?: string | null
          genetic_profile_id?: string
          genotype?: string
          id?: string
          position?: number | null
          rsid?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_variants_genetic_profile_id_fkey"
            columns: ["genetic_profile_id"]
            isOneToOne: false
            referencedRelation: "genetic_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_intakes: {
        Row: {
          amount: string | null
          created_at: string
          id: string
          supplement_id: string
          time_of_day: string
          user_id: string
        }
        Insert: {
          amount?: string | null
          created_at?: string
          id?: string
          supplement_id: string
          time_of_day: string
          user_id: string
        }
        Update: {
          amount?: string | null
          created_at?: string
          id?: string
          supplement_id?: string
          time_of_day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplement_intakes_supplement_id_fkey"
            columns: ["supplement_id"]
            isOneToOne: false
            referencedRelation: "supplements"
            referencedColumns: ["id"]
          },
        ]
      }
      supplements: {
        Row: {
          created_at: string
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          biomarker_id: string
          blood_test_id: string
          created_at: string
          id: string
          qualifier: string | null
          unit: string
          value: number
        }
        Insert: {
          biomarker_id: string
          blood_test_id: string
          created_at?: string
          id?: string
          qualifier?: string | null
          unit: string
          value: number
        }
        Update: {
          biomarker_id?: string
          blood_test_id?: string
          created_at?: string
          id?: string
          qualifier?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_results_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_blood_test_id_fkey"
            columns: ["blood_test_id"]
            isOneToOne: false
            referencedRelation: "blood_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unit_preferences: {
        Row: {
          biomarker_id: string
          created_at: string
          id: string
          preferred_unit: string
          user_id: string
        }
        Insert: {
          biomarker_id: string
          created_at?: string
          id?: string
          preferred_unit: string
          user_id: string
        }
        Update: {
          biomarker_id?: string
          created_at?: string
          id?: string
          preferred_unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unit_preferences_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          priority: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          priority?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          priority?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlist_sources: {
        Row: {
          brand: string | null
          created_at: string
          currency: string | null
          id: string
          item_id: string
          price: number | null
          url: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          item_id: string
          price?: number | null
          url?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          item_id?: string
          price?: number | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      take_ai_request: {
        Args: {
          p_per_day: number
          p_per_hour: number
          p_user_id: string
        }
        Returns: boolean
      }
      apply_next_to_test_move: {
        Args: {
          p_delete_ids: string[]
          p_list_id: string
          p_move_ids: string[]
          p_patches: Json
        }
        Returns: number
      }
      get_latest_scrape_jobs: {
        Args: never
        Returns: {
          created_at: string
          error: string | null
          id: string
          inserted: number
          lab_id: string
          logs: string
          profile_updated: boolean
          skipped: number
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scrape_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      replace_blood_test_results: {
        Args: {
          p_name: string
          p_notes: string
          p_results: Json
          p_sample_type: string
          p_test_date: string
          p_test_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      search_nevo: {
        Args: { max_results?: number; q: string }
        Returns: {
          carbs_per_100g: number | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          food_group_en: string | null
          food_group_nl: string | null
          kcal_per_100g: number | null
          name_en: string | null
          name_nl: string
          nevo_code: string
          protein_per_100g: number | null
          sat_fat_per_100g: number | null
          search_text: string | null
          sodium_mg_per_100g: number | null
          sugar_per_100g: number | null
          synonyms: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "nevo_foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
