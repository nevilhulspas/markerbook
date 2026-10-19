-- Baseline schema for Bloodmarkers (generated 2026-10-19 from the production
-- schema with `supabase db dump --schema public`). It replaces the earlier
-- migration history, which could not build a database from scratch. New
-- schema changes go in new migration files after this one.

create extension if not exists pg_trgm with schema public;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."apply_next_to_test_move"("p_list_id" "uuid", "p_move_ids" "uuid"[], "p_patches" "jsonb", "p_delete_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_patch jsonb;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce(cardinality(p_move_ids), 0) > 0 then
    update public.next_to_test
       set list_id = p_list_id
     where id = any (p_move_ids)
       and user_id = v_user;
    get diagnostics v_count = row_count;
    if v_count <> cardinality(p_move_ids) then
      raise exception 'move_changed' using errcode = 'P0001';
    end if;
  end if;

  for v_patch in select value from jsonb_array_elements(coalesce(p_patches, '[]'::jsonb))
  loop
    -- A twin with nothing to absorb is only checked (and locked), never
    -- written: an UPDATE would fire trg_next_to_test_updated and bump
    -- updated_at, which reorders the Done list.
    if (v_patch - 'id') = '{}'::jsonb then
      perform 1
         from public.next_to_test
        where id = (v_patch ->> 'id')::uuid
          and user_id = v_user
          for update;
      if not found then
        raise exception 'move_changed' using errcode = 'P0001';
      end if;
      continue;
    end if;

    update public.next_to_test
       set status   = case when v_patch ? 'status'   then v_patch ->> 'status'                else status   end,
           note     = case when v_patch ? 'note'     then v_patch ->> 'note'                  else note     end,
           due_date = case when v_patch ? 'due_date' then (v_patch ->> 'due_date')::date      else due_date end
     where id = (v_patch ->> 'id')::uuid
       and user_id = v_user;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'move_changed' using errcode = 'P0001';
    end if;
  end loop;

  if coalesce(cardinality(p_delete_ids), 0) = 0 then
    return 0;
  end if;

  delete from public.next_to_test
   where id = any (p_delete_ids)
     and user_id = v_user;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."apply_next_to_test_move"("p_list_id" "uuid", "p_move_ids" "uuid"[], "p_patches" "jsonb", "p_delete_ids" "uuid"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."scrape_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "logs" "text" DEFAULT ''::"text" NOT NULL,
    "inserted" integer DEFAULT 0 NOT NULL,
    "skipped" integer DEFAULT 0 NOT NULL,
    "profile_updated" boolean DEFAULT false NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scrape_jobs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'done'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."scrape_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_scrape_jobs"() RETURNS SETOF "public"."scrape_jobs"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT DISTINCT ON (lab_id) *
  FROM public.scrape_jobs
  ORDER BY lab_id, created_at DESC
$$;


ALTER FUNCTION "public"."get_latest_scrape_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_to_test_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."next_to_test_touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nevo_foods" (
    "nevo_code" "text" NOT NULL,
    "name_nl" "text" NOT NULL,
    "name_en" "text",
    "synonyms" "text",
    "food_group_nl" "text",
    "food_group_en" "text",
    "kcal_per_100g" numeric,
    "protein_per_100g" numeric,
    "carbs_per_100g" numeric,
    "fat_per_100g" numeric,
    "fiber_per_100g" numeric,
    "sugar_per_100g" numeric,
    "sodium_mg_per_100g" numeric,
    "sat_fat_per_100g" numeric,
    "search_text" "text" GENERATED ALWAYS AS ("lower"(((((COALESCE("name_nl", ''::"text") || ' '::"text") || COALESCE("name_en", ''::"text")) || ' '::"text") || COALESCE("synonyms", ''::"text")))) STORED
);


ALTER TABLE "public"."nevo_foods" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_nevo"("q" "text", "max_results" integer DEFAULT 5) RETURNS SETOF "public"."nevo_foods"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select * from public.nevo_foods
  where search_text % lower(q) or search_text like '%' || lower(q) || '%'
  order by greatest(similarity(search_text, lower(q)),
                    case when search_text like '%' || lower(q) || '%' then 0.6 else 0 end) desc
  limit max_results;
$$;


ALTER FUNCTION "public"."search_nevo"("q" "text", "max_results" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."take_ai_request"("p_user_id" "uuid", "p_per_hour" integer, "p_per_day" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_hour integer;
  v_day integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_requests:' || p_user_id::text, 0));

  -- Rows older than a day no longer count; drop this user's old ones.
  delete from public.ai_requests
   where user_id = p_user_id
     and created_at < now() - interval '1 day';

  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*)
    into v_hour, v_day
    from public.ai_requests
   where user_id = p_user_id
     and created_at > now() - interval '1 day';

  if (p_per_hour > 0 and v_hour >= p_per_hour) or (p_per_day > 0 and v_day >= p_per_day) then
    return false;
  end if;

  insert into public.ai_requests (user_id) values (p_user_id);
  return true;
end;
$$;


ALTER FUNCTION "public"."take_ai_request"("p_user_id" "uuid", "p_per_hour" integer, "p_per_day" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_requests" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_requests" OWNER TO "postgres";


ALTER TABLE "public"."ai_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ai_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" "date",
    CONSTRAINT "annotations_date_range_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "date")))
);


ALTER TABLE "public"."annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "changes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_action_check" CHECK (("action" = ANY (ARRAY['create'::"text", 'update'::"text", 'archive'::"text", 'delete'::"text", 'approve'::"text", 'reject'::"text", 'verify'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biomarker_descriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "model" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."biomarker_descriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biomarker_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."biomarker_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biomarker_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "unit" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "conversion_factor" numeric DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."biomarker_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biomarkers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "category" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "description" "text",
    "ref_range_low" numeric,
    "ref_range_high" numeric,
    "ref_range_low_male" numeric,
    "ref_range_high_male" numeric,
    "ref_range_low_female" numeric,
    "ref_range_high_female" numeric,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "variant_name" "text",
    "panel_id" "uuid",
    "archived_at" timestamp with time zone,
    "loinc_code" "text",
    "method" "text",
    "range_source" "text",
    "is_custom" boolean DEFAULT false NOT NULL,
    CONSTRAINT "biomarkers_range_source_check" CHECK (("range_source" = ANY (ARRAY['curated'::"text", 'report'::"text", 'ai_estimated'::"text"])))
);


ALTER TABLE "public"."biomarkers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."biomarkers"."is_custom" IS 'True for markers auto-created from a lab report with no catalog/LOINC match (custom capture). Curated and LOINC-anchored markers are false.';



CREATE TABLE IF NOT EXISTS "public"."blood_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "test_date" "date" NOT NULL,
    "sample_type" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pdf_storage_path" "text",
    CONSTRAINT "blood_tests_sample_type_check" CHECK (("sample_type" = ANY (ARRAY['serum'::"text", 'plasma'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."blood_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metric" "text" NOT NULL,
    "target_value" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "body_goals_metric_check" CHECK (("metric" = ANY (ARRAY['body_fat_pct'::"text", 'lean_mass_kg'::"text", 'total_mass_kg'::"text", 'visceral_fat_g'::"text", 'ffmi'::"text", 'almi'::"text", 'bone_t_score'::"text"])))
);


ALTER TABLE "public"."body_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_log_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "logged_on" "date" NOT NULL,
    "weight_kg" numeric,
    "body_fat_pct" numeric,
    "waist_cm" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."body_log_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_document_extractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "extraction" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_document_extractions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_memory_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "path" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_memory_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "tool_invocations" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachments" "jsonb",
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'tool'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New conversation'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinvar_cache" (
    "rsid" "text" NOT NULL,
    "gene_name" "text",
    "variant_name" "text",
    "clinical_significance" "text",
    "conditions" "text",
    "review_status" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clinvar_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_foods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "kcal_per_100g" numeric,
    "protein_per_100g" numeric,
    "carbs_per_100g" numeric,
    "fat_per_100g" numeric,
    "fiber_per_100g" numeric,
    "sugar_per_100g" numeric,
    "sodium_mg_per_100g" numeric,
    "sat_fat_per_100g" numeric,
    "default_grams" numeric DEFAULT 100 NOT NULL,
    "notes" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."custom_foods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dexa_regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scan_id" "uuid" NOT NULL,
    "region" "text" NOT NULL,
    "fat_pct" numeric,
    "fat_mass_g" numeric,
    "lean_mass_g" numeric,
    "bmc_g" numeric,
    "total_mass_g" numeric,
    "bmd" numeric,
    "t_score" numeric,
    "z_score" numeric,
    CONSTRAINT "dexa_regions_region_check" CHECK (("region" = ANY (ARRAY['arms'::"text", 'arm_left'::"text", 'arm_right'::"text", 'legs'::"text", 'leg_left'::"text", 'leg_right'::"text", 'trunk'::"text", 'trunk_left'::"text", 'trunk_right'::"text", 'android'::"text", 'gynoid'::"text", 'total'::"text", 'head'::"text", 'ribs'::"text", 'spine'::"text", 'pelvis'::"text"])))
);


ALTER TABLE "public"."dexa_regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dexa_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scan_date" "date" NOT NULL,
    "provider" "text",
    "age_years" numeric,
    "height_cm" numeric,
    "weight_kg" numeric,
    "total_mass_kg" numeric,
    "fat_mass_g" numeric,
    "lean_mass_g" numeric,
    "bmc_g" numeric,
    "body_fat_pct" numeric,
    "visceral_fat_g" numeric,
    "android_fat_pct" numeric,
    "gynoid_fat_pct" numeric,
    "android_gynoid_ratio" numeric,
    "almi" numeric,
    "ffmi" numeric,
    "bone_t_score" numeric,
    "bone_z_score" numeric,
    "total_bmd" numeric,
    "source" "text" DEFAULT 'summary'::"text" NOT NULL,
    "notes" "text",
    "pdf_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dexa_scans_source_check" CHECK (("source" = ANY (ARRAY['summary'::"text", 'raw'::"text", 'manual'::"text", 'merged'::"text"])))
);


ALTER TABLE "public"."dexa_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_computed_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dutch_test_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "formula" "text",
    "source_marker_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dutch_computed_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_marker_descriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "model" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dutch_marker_descriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_marker_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "unit" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "conversion_factor" numeric DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dutch_marker_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_markers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "category" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "description" "text",
    "ref_range_low" numeric,
    "ref_range_high" numeric,
    "ref_range_low_male" numeric,
    "ref_range_high_male" numeric,
    "ref_range_low_female" numeric,
    "ref_range_high_female" numeric,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "variant_name" "text",
    "panel_id" "uuid",
    "archived_at" timestamp with time zone,
    "loinc_code" "text",
    "method" "text"
);


ALTER TABLE "public"."dutch_markers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_reference_ranges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "unit" "text" NOT NULL,
    "sex" "text",
    "age_min" integer,
    "age_max" integer,
    "range_low" numeric,
    "range_high" numeric,
    "source" "text" DEFAULT 'seeded'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "range_type" "text" DEFAULT 'normal'::"text" NOT NULL,
    "phase" "text",
    "source_url" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    CONSTRAINT "reference_ranges_phase_check" CHECK (("phase" = ANY (ARRAY['follicular'::"text", 'luteal'::"text", 'postmenopausal'::"text", 'oral_progesterone'::"text", 'oral_contraceptive'::"text"]))),
    CONSTRAINT "reference_ranges_range_type_check" CHECK (("range_type" = ANY (ARRAY['normal'::"text", 'optimal'::"text"]))),
    CONSTRAINT "reference_ranges_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."dutch_reference_ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_test_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dutch_test_id" "uuid" NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "timepoint" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dutch_test_results_timepoint_check" CHECK (("timepoint" = ANY (ARRAY['waking'::"text", 'morning'::"text", 'afternoon'::"text", 'night'::"text"])))
);


ALTER TABLE "public"."dutch_test_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "test_date" "date" NOT NULL,
    "menstrual_phase" "text",
    "cycle_day" integer,
    "notes" "text",
    "pdf_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dutch_tests_menstrual_phase_check" CHECK (("menstrual_phase" = ANY (ARRAY['follicular'::"text", 'luteal'::"text", 'postmenopausal'::"text", 'oral_progesterone'::"text", 'oral_contraceptive'::"text", 'male'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."dutch_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" timestamp with time zone NOT NULL,
    "raw_input" "text",
    "food_name" "text" NOT NULL,
    "calories" numeric,
    "protein_g" numeric,
    "carbs_g" numeric,
    "fat_g" numeric,
    "fiber_g" numeric,
    "sugar_g" numeric,
    "sodium_mg" numeric,
    "saturated_fat_g" numeric,
    "meal_type" "text",
    "notes" "text",
    "source" "text" DEFAULT 'app'::"text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "grams" numeric,
    "match_source" "text",
    "match_ref" "text",
    "recipe_id" "uuid",
    "custom_food_id" "uuid",
    "submission_id" "uuid",
    "image_path" "text",
    "weight_estimated" boolean DEFAULT false NOT NULL,
    CONSTRAINT "food_logs_match_source_check" CHECK (("match_source" = ANY (ARRAY['nevo'::"text", 'off'::"text", 'custom_food'::"text", 'recipe'::"text", 'estimate'::"text", 'manual'::"text", 'legacy_usda'::"text"]))),
    CONSTRAINT "food_logs_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'snack'::"text"]))),
    CONSTRAINT "food_logs_source_check" CHECK (("source" = ANY (ARRAY['app'::"text", 'voice'::"text", 'shortcut'::"text", 'import'::"text", 'migration'::"text", 'photo'::"text"])))
);


ALTER TABLE "public"."food_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."genetic_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text",
    "import_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_storage_path" "text",
    "snp_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."genetic_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."impersonation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interpretations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "blood_test_id" "uuid" NOT NULL,
    "test_result_id" "uuid",
    "type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "profile_hash" "text" NOT NULL,
    "marker_context_hash" "text" NOT NULL,
    "model" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "interpretations_type_check" CHECK (("type" = ANY (ARRAY['single_marker'::"text", 'full_test'::"text", 'biomarker_insight'::"text"])))
);


ALTER TABLE "public"."interpretations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lab_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lab_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_test_biomarkers" (
    "lab_test_id" "uuid" NOT NULL,
    "biomarker_id" "uuid" NOT NULL
);


ALTER TABLE "public"."lab_test_biomarkers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "method" "text",
    "cost" numeric,
    "currency" "text",
    "turnaround_days" integer,
    "sample_type" "text",
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_by" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text",
    CONSTRAINT "lab_tests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."lab_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text",
    "city" "text",
    "website" "text",
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_by" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "labs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."labs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loinc_display" (
    "loinc_num" "text" NOT NULL,
    "clean_name" "text",
    "abbreviation" "text",
    "model" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loinc_display" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loinc_terms" (
    "loinc_num" "text" NOT NULL,
    "component" "text",
    "property" "text",
    "time_aspct" "text",
    "system" "text",
    "scale_typ" "text",
    "method_typ" "text",
    "class" "text",
    "classtype" integer,
    "status" "text",
    "example_ucum_units" "text",
    "long_common_name" "text",
    "short_name" "text",
    "version_last_changed" "text"
);


ALTER TABLE "public"."loinc_terms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marker_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "created_biomarker_id" "uuid",
    "category" "text",
    CONSTRAINT "marker_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "marker_suggestions_type_check" CHECK (("type" = ANY (ARRAY['marker'::"text", 'unit'::"text"])))
);


ALTER TABLE "public"."marker_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_conditions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "condition_name" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "medical_conditions_end_after_start_chk" CHECK ((("start_date" IS NULL) OR ("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."medical_conditions" OWNER TO "postgres";


COMMENT ON TABLE "public"."medical_conditions" IS 'Per-user list of previous or ongoing medical conditions. NULL end_date means ongoing.';



CREATE TABLE IF NOT EXISTS "public"."microbiome_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "microbiome_test_id" "uuid" NOT NULL,
    "taxon_id" "uuid" NOT NULL,
    "value" numeric,
    "unit" "text" DEFAULT '%'::"text",
    "ref_low" numeric,
    "ref_high" numeric,
    "status" "text",
    "raw_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "microbiome_results_status_check" CHECK (("status" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."microbiome_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."microbiome_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "microbiome_test_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text",
    "ref_low" numeric,
    "ref_high" numeric,
    "status" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "microbiome_scores_status_check" CHECK (("status" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."microbiome_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."microbiome_taxa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "rank" "text" NOT NULL,
    "parent_id" "uuid",
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "category" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "microbiome_taxa_category_check" CHECK (("category" = ANY (ARRAY['beneficial'::"text", 'commensal'::"text", 'opportunistic'::"text", 'pathogenic'::"text", 'unknown'::"text"]))),
    CONSTRAINT "microbiome_taxa_rank_check" CHECK (("rank" = ANY (ARRAY['kingdom'::"text", 'phylum'::"text", 'class'::"text", 'order'::"text", 'family'::"text", 'genus'::"text", 'species'::"text", 'strain'::"text", 'functional_group'::"text"])))
);


ALTER TABLE "public"."microbiome_taxa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."microbiome_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "test_date" "date" NOT NULL,
    "lab_name" "text",
    "sample_type" "text" DEFAULT 'stool'::"text",
    "notes" "text",
    "pdf_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."microbiome_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."next_to_test" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "biomarker_id" "uuid",
    "lab_test_id" "uuid",
    "note" "text",
    "due_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "test_type" "text" NOT NULL,
    "custom_name" "text",
    CONSTRAINT "next_to_test_kind_chk" CHECK (((("test_type" = 'blood_biomarker'::"text") AND ("biomarker_id" IS NOT NULL) AND ("lab_test_id" IS NULL)) OR (("test_type" = 'blood_lab_test'::"text") AND ("biomarker_id" IS NULL) AND ("lab_test_id" IS NOT NULL)) OR (("test_type" = ANY (ARRAY['dexa'::"text", 'microbiome'::"text", 'dutch'::"text", 'genetic'::"text"])) AND ("biomarker_id" IS NULL) AND ("lab_test_id" IS NULL)) OR (("test_type" = 'other'::"text") AND ("biomarker_id" IS NULL) AND ("lab_test_id" IS NULL) AND ("custom_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "custom_name")) > 0)))),
    CONSTRAINT "next_to_test_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."next_to_test" OWNER TO "postgres";


COMMENT ON COLUMN "public"."next_to_test"."test_type" IS 'Category — blood_biomarker | blood_lab_test | dexa | microbiome | dutch | genetic | other.';



COMMENT ON COLUMN "public"."next_to_test"."custom_name" IS 'User-facing label. Required for ''other'' (free-text test name). Optional override for the typed categories.';



CREATE TABLE IF NOT EXISTS "public"."next_to_test_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "next_to_test_lists_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."next_to_test_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."other_test_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "value" "text",
    "unit" "text",
    "flag" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."other_test_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."other_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_name" "text" NOT NULL,
    "test_date" "date" NOT NULL,
    "provider" "text",
    "outcome" "text" DEFAULT 'not_applicable'::"text" NOT NULL,
    "result_summary" "text",
    "notes" "text",
    "interpretation" "text",
    "interpreted_at" timestamp with time zone,
    "source" "text" DEFAULT 'import'::"text" NOT NULL,
    "pdf_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "other_tests_outcome_check" CHECK (("outcome" = ANY (ARRAY['positive'::"text", 'negative'::"text", 'normal'::"text", 'abnormal'::"text", 'inconclusive'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "other_tests_source_check" CHECK (("source" = ANY (ARRAY['import'::"text", 'manual'::"text", 'summary'::"text"])))
);


ALTER TABLE "public"."other_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."panels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "system_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "loinc_code" "text"
);


ALTER TABLE "public"."panels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "date_of_birth" "date",
    "sex" "text",
    "height_cm" numeric(5,1),
    "weight_kg" numeric(5,1),
    "activity_level" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impersonatable" boolean DEFAULT false NOT NULL,
    "extra_notes" "text",
    "born_via_csection" boolean,
    "breastfed_as_infant" boolean,
    "smoking_status" "text",
    "alcohol_drinks_per_week" numeric(5,1),
    "pregnancy_status" "text",
    "known_allergies" "text",
    "family_history" "text",
    "diet_pattern" "text",
    "nutrition_calorie_target" integer,
    "nutrition_protein_target_g" integer,
    "nutrition_carbs_target_g" integer,
    "nutrition_fat_target_g" integer,
    "nutrition_log_token" "uuid" DEFAULT "gen_random_uuid"(),
    "display_name" "text",
    CONSTRAINT "profiles_activity_level_check" CHECK (("activity_level" = ANY (ARRAY['sedentary'::"text", 'light'::"text", 'moderate'::"text", 'active'::"text", 'very_active'::"text"]))),
    CONSTRAINT "profiles_alcohol_drinks_per_week_check" CHECK ((("alcohol_drinks_per_week" >= (0)::numeric) AND ("alcohol_drinks_per_week" <= (200)::numeric))),
    CONSTRAINT "profiles_diet_pattern_check" CHECK (("diet_pattern" = ANY (ARRAY['omnivore'::"text", 'pescatarian'::"text", 'vegetarian'::"text", 'vegan'::"text", 'keto'::"text", 'carnivore'::"text", 'other'::"text"]))),
    CONSTRAINT "profiles_display_name_check" CHECK ((("display_name" IS NULL) OR ("char_length"("display_name") <= 200))),
    CONSTRAINT "profiles_nutrition_calorie_target_check" CHECK ((("nutrition_calorie_target" IS NULL) OR ("nutrition_calorie_target" >= 0))),
    CONSTRAINT "profiles_nutrition_carbs_target_g_check" CHECK ((("nutrition_carbs_target_g" IS NULL) OR ("nutrition_carbs_target_g" >= 0))),
    CONSTRAINT "profiles_nutrition_fat_target_g_check" CHECK ((("nutrition_fat_target_g" IS NULL) OR ("nutrition_fat_target_g" >= 0))),
    CONSTRAINT "profiles_nutrition_protein_target_g_check" CHECK ((("nutrition_protein_target_g" IS NULL) OR ("nutrition_protein_target_g" >= 0))),
    CONSTRAINT "profiles_pregnancy_status_check" CHECK (("pregnancy_status" = ANY (ARRAY['not_pregnant'::"text", 'pregnant'::"text", 'breastfeeding'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "profiles_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"]))),
    CONSTRAINT "profiles_smoking_status_check" CHECK (("smoking_status" = ANY (ARRAY['never'::"text", 'former'::"text", 'current'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."extra_notes" IS 'Free-text anything the AI should know about the user.';



COMMENT ON COLUMN "public"."profiles"."born_via_csection" IS 'Born via C-section? Relevant for gut-microbiome baseline.';



COMMENT ON COLUMN "public"."profiles"."breastfed_as_infant" IS 'Breastfed as an infant? Relevant for gut-microbiome baseline.';



COMMENT ON COLUMN "public"."profiles"."smoking_status" IS 'never | former | current — impacts CRP, WBC, lipids, B12.';



COMMENT ON COLUMN "public"."profiles"."alcohol_drinks_per_week" IS 'Average alcoholic drinks per week — impacts GGT, ALT, AST, MCV, HDL.';



COMMENT ON COLUMN "public"."profiles"."pregnancy_status" IS 'not_pregnant | pregnant | breastfeeding | not_applicable — impacts hormones, iron, lipids. not_applicable is for users the field does not apply to (e.g. men); omitted from the chat prompt.';



COMMENT ON COLUMN "public"."profiles"."known_allergies" IS 'Drug/food/environmental allergies, free text.';



COMMENT ON COLUMN "public"."profiles"."family_history" IS 'Family medical history (diabetes, heart disease, thyroid, …).';



COMMENT ON COLUMN "public"."profiles"."diet_pattern" IS 'omnivore | pescatarian | vegetarian | vegan | keto | carnivore | other.';



CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "nevo_code" "text",
    "off_barcode" "text",
    "custom_food_id" "uuid",
    "raw_name" "text",
    "grams" numeric NOT NULL,
    "kcal_per_100g" numeric,
    "protein_per_100g" numeric,
    "carbs_per_100g" numeric,
    "fat_per_100g" numeric,
    "fiber_per_100g" numeric,
    "sugar_per_100g" numeric,
    "sodium_mg_per_100g" numeric,
    "sat_fat_per_100g" numeric
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "total_grams" numeric DEFAULT 0 NOT NULL,
    "total_kcal" numeric DEFAULT 0 NOT NULL,
    "total_protein" numeric DEFAULT 0 NOT NULL,
    "total_carbs" numeric DEFAULT 0 NOT NULL,
    "total_fat" numeric DEFAULT 0 NOT NULL,
    "total_fiber" numeric DEFAULT 0 NOT NULL,
    "total_sugar" numeric DEFAULT 0 NOT NULL,
    "total_sodium_mg" numeric DEFAULT 0 NOT NULL,
    "total_sat_fat" numeric DEFAULT 0 NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reference_ranges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "unit" "text" NOT NULL,
    "sex" "text" NOT NULL,
    "age_min" integer,
    "age_max" integer,
    "range_low" numeric,
    "range_high" numeric,
    "source" "text" DEFAULT 'seeded'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "range_type" "text" DEFAULT 'normal'::"text" NOT NULL,
    "phase" "text",
    "source_url" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    CONSTRAINT "reference_ranges_phase_check" CHECK (("phase" = ANY (ARRAY['follicular'::"text", 'luteal'::"text", 'postmenopausal'::"text", 'oral_progesterone'::"text", 'oral_contraceptive'::"text"]))),
    CONSTRAINT "reference_ranges_range_type_check" CHECK (("range_type" = ANY (ARRAY['normal'::"text", 'optimal'::"text"]))),
    CONSTRAINT "reference_ranges_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."reference_ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rmr_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_date" "date" NOT NULL,
    "provider" "text",
    "rmr_kcal" numeric NOT NULL,
    "predicted_rmr_kcal" numeric,
    "rer" numeric,
    "fuel_carb_pct" numeric,
    "fuel_fat_pct" numeric,
    "source" "text" DEFAULT 'import'::"text" NOT NULL,
    "notes" "text",
    "pdf_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rmr_tests_source_check" CHECK (("source" = ANY (ARRAY['import'::"text", 'manual'::"text", 'summary'::"text"])))
);


ALTER TABLE "public"."rmr_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rna_expressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rna_test_id" "uuid" NOT NULL,
    "gene_name" "text" NOT NULL,
    "expression_value" numeric,
    "unit" "text",
    "fold_change" numeric,
    "p_value" numeric,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rna_expressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rna_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "test_date" "date" NOT NULL,
    "source" "text",
    "file_storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rna_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."snp_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "genetic_profile_id" "uuid" NOT NULL,
    "rsid" "text" NOT NULL,
    "chromosome" "text",
    "position" integer,
    "genotype" "text" NOT NULL,
    "gene_name" "text",
    "variant_name" "text",
    "clinical_significance" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snp_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplement_intakes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "time_of_day" time without time zone NOT NULL,
    "amount" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplement_intakes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "dose" "text",
    "frequency" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."systems" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."systems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blood_test_id" "uuid" NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_unit_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "biomarker_id" "uuid" NOT NULL,
    "preferred_unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_unit_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "priority" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wishlist_items_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."wishlist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand" "text",
    "url" "text",
    "price" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wishlist_sources" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biomarker_descriptions"
    ADD CONSTRAINT "biomarker_descriptions_biomarker_id_key" UNIQUE ("biomarker_id");



ALTER TABLE ONLY "public"."biomarker_descriptions"
    ADD CONSTRAINT "biomarker_descriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biomarker_favorites"
    ADD CONSTRAINT "biomarker_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biomarker_favorites"
    ADD CONSTRAINT "biomarker_favorites_user_id_biomarker_id_key" UNIQUE ("user_id", "biomarker_id");



ALTER TABLE ONLY "public"."biomarker_units"
    ADD CONSTRAINT "biomarker_units_biomarker_id_unit_key" UNIQUE ("biomarker_id", "unit");



ALTER TABLE ONLY "public"."biomarker_units"
    ADD CONSTRAINT "biomarker_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blood_tests"
    ADD CONSTRAINT "blood_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_goals"
    ADD CONSTRAINT "body_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_goals"
    ADD CONSTRAINT "body_goals_user_id_metric_key" UNIQUE ("user_id", "metric");



ALTER TABLE ONLY "public"."body_log_entries"
    ADD CONSTRAINT "body_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_document_extractions"
    ADD CONSTRAINT "chat_document_extractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_memory_files"
    ADD CONSTRAINT "chat_memory_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_memory_files"
    ADD CONSTRAINT "chat_memory_files_user_id_path_key" UNIQUE ("user_id", "path");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_threads"
    ADD CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinvar_cache"
    ADD CONSTRAINT "clinvar_cache_pkey" PRIMARY KEY ("rsid");



ALTER TABLE ONLY "public"."custom_foods"
    ADD CONSTRAINT "custom_foods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dexa_regions"
    ADD CONSTRAINT "dexa_regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dexa_regions"
    ADD CONSTRAINT "dexa_regions_scan_id_region_key" UNIQUE ("scan_id", "region");



ALTER TABLE ONLY "public"."dexa_scans"
    ADD CONSTRAINT "dexa_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_computed_values"
    ADD CONSTRAINT "dutch_computed_values_dutch_test_id_name_key" UNIQUE ("dutch_test_id", "name");



ALTER TABLE ONLY "public"."dutch_computed_values"
    ADD CONSTRAINT "dutch_computed_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_marker_descriptions"
    ADD CONSTRAINT "dutch_marker_descriptions_biomarker_id_key" UNIQUE ("biomarker_id");



ALTER TABLE ONLY "public"."dutch_marker_descriptions"
    ADD CONSTRAINT "dutch_marker_descriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_marker_units"
    ADD CONSTRAINT "dutch_marker_units_biomarker_id_unit_key" UNIQUE ("biomarker_id", "unit");



ALTER TABLE ONLY "public"."dutch_marker_units"
    ADD CONSTRAINT "dutch_marker_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_markers"
    ADD CONSTRAINT "dutch_markers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."dutch_markers"
    ADD CONSTRAINT "dutch_markers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_reference_ranges"
    ADD CONSTRAINT "dutch_reference_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_test_results"
    ADD CONSTRAINT "dutch_test_results_dutch_test_id_biomarker_id_timepoint_key" UNIQUE ("dutch_test_id", "biomarker_id", "timepoint");



ALTER TABLE ONLY "public"."dutch_test_results"
    ADD CONSTRAINT "dutch_test_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_tests"
    ADD CONSTRAINT "dutch_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genetic_profiles"
    ADD CONSTRAINT "genetic_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interpretations"
    ADD CONSTRAINT "interpretations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_favorites"
    ADD CONSTRAINT "lab_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_favorites"
    ADD CONSTRAINT "lab_favorites_user_id_lab_id_key" UNIQUE ("user_id", "lab_id");



ALTER TABLE ONLY "public"."lab_test_biomarkers"
    ADD CONSTRAINT "lab_test_biomarkers_pkey" PRIMARY KEY ("lab_test_id", "biomarker_id");



ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labs"
    ADD CONSTRAINT "labs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loinc_display"
    ADD CONSTRAINT "loinc_display_pkey" PRIMARY KEY ("loinc_num");



ALTER TABLE ONLY "public"."loinc_terms"
    ADD CONSTRAINT "loinc_terms_pkey" PRIMARY KEY ("loinc_num");



ALTER TABLE ONLY "public"."marker_suggestions"
    ADD CONSTRAINT "marker_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_conditions"
    ADD CONSTRAINT "medical_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microbiome_results"
    ADD CONSTRAINT "microbiome_results_microbiome_test_id_taxon_id_key" UNIQUE ("microbiome_test_id", "taxon_id");



ALTER TABLE ONLY "public"."microbiome_results"
    ADD CONSTRAINT "microbiome_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microbiome_scores"
    ADD CONSTRAINT "microbiome_scores_microbiome_test_id_name_key" UNIQUE ("microbiome_test_id", "name");



ALTER TABLE ONLY "public"."microbiome_scores"
    ADD CONSTRAINT "microbiome_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microbiome_taxa"
    ADD CONSTRAINT "microbiome_taxa_name_rank_key" UNIQUE ("name", "rank");



ALTER TABLE ONLY "public"."microbiome_taxa"
    ADD CONSTRAINT "microbiome_taxa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microbiome_tests"
    ADD CONSTRAINT "microbiome_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nevo_foods"
    ADD CONSTRAINT "nevo_foods_pkey" PRIMARY KEY ("nevo_code");



ALTER TABLE ONLY "public"."next_to_test_lists"
    ADD CONSTRAINT "next_to_test_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."next_to_test"
    ADD CONSTRAINT "next_to_test_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."other_test_values"
    ADD CONSTRAINT "other_test_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."other_tests"
    ADD CONSTRAINT "other_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panels"
    ADD CONSTRAINT "panels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."panels"
    ADD CONSTRAINT "panels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_nutrition_log_token_key" UNIQUE ("nutrition_log_token");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reference_ranges"
    ADD CONSTRAINT "reference_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rmr_tests"
    ADD CONSTRAINT "rmr_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rna_expressions"
    ADD CONSTRAINT "rna_expressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rna_tests"
    ADD CONSTRAINT "rna_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scrape_jobs"
    ADD CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snp_variants"
    ADD CONSTRAINT "snp_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplement_intakes"
    ADD CONSTRAINT "supplement_intakes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplement_intakes"
    ADD CONSTRAINT "supplement_intakes_supplement_id_time_of_day_key" UNIQUE ("supplement_id", "time_of_day");



ALTER TABLE ONLY "public"."supplements"
    ADD CONSTRAINT "supplements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."systems"
    ADD CONSTRAINT "systems_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."systems"
    ADD CONSTRAINT "systems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."systems"
    ADD CONSTRAINT "systems_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."test_results"
    ADD CONSTRAINT "test_results_blood_test_id_biomarker_id_key" UNIQUE ("blood_test_id", "biomarker_id");



ALTER TABLE ONLY "public"."test_results"
    ADD CONSTRAINT "test_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_unit_preferences"
    ADD CONSTRAINT "user_unit_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_unit_preferences"
    ADD CONSTRAINT "user_unit_preferences_user_id_biomarker_id_key" UNIQUE ("user_id", "biomarker_id");



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_sources"
    ADD CONSTRAINT "wishlist_sources_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_requests_user_created_idx" ON "public"."ai_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_user_id_fk_idx" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "biomarker_favorites_biomarker_id_fk_idx" ON "public"."biomarker_favorites" USING "btree" ("biomarker_id");



CREATE INDEX "biomarkers_aliases_idx" ON "public"."biomarkers" USING "gin" ("aliases");



CREATE INDEX "biomarkers_archived_at_idx" ON "public"."biomarkers" USING "btree" ("archived_at") WHERE ("archived_at" IS NULL);



CREATE INDEX "biomarkers_category_idx" ON "public"."biomarkers" USING "btree" ("category");



CREATE INDEX "biomarkers_loinc_code_idx" ON "public"."biomarkers" USING "btree" ("loinc_code");



CREATE UNIQUE INDEX "biomarkers_loinc_code_unique" ON "public"."biomarkers" USING "btree" ("loinc_code") WHERE (("loinc_code" IS NOT NULL) AND ("archived_at" IS NULL));



CREATE INDEX "biomarkers_name_idx" ON "public"."biomarkers" USING "btree" ("name");



CREATE UNIQUE INDEX "biomarkers_name_live_unique" ON "public"."biomarkers" USING "btree" ("name") WHERE ("archived_at" IS NULL);



CREATE INDEX "biomarkers_panel_id_idx" ON "public"."biomarkers" USING "btree" ("panel_id");



CREATE INDEX "biomarkers_parent_id_idx" ON "public"."biomarkers" USING "btree" ("parent_id");



CREATE INDEX "blood_tests_test_date_idx" ON "public"."blood_tests" USING "btree" ("test_date");



CREATE INDEX "blood_tests_user_id_test_date_idx" ON "public"."blood_tests" USING "btree" ("user_id", "test_date");



CREATE INDEX "chat_document_extractions_thread_id_fk_idx" ON "public"."chat_document_extractions" USING "btree" ("thread_id");



CREATE INDEX "dutch_computed_values_dutch_test_id_idx" ON "public"."dutch_computed_values" USING "btree" ("dutch_test_id");



CREATE INDEX "dutch_marker_descriptions_biomarker_id_idx" ON "public"."dutch_marker_descriptions" USING "btree" ("biomarker_id");



CREATE INDEX "dutch_markers_aliases_idx" ON "public"."dutch_markers" USING "gin" ("aliases");



CREATE INDEX "dutch_markers_archived_at_idx" ON "public"."dutch_markers" USING "btree" ("archived_at") WHERE ("archived_at" IS NULL);



CREATE INDEX "dutch_markers_category_idx" ON "public"."dutch_markers" USING "btree" ("category");



CREATE INDEX "dutch_markers_loinc_code_idx" ON "public"."dutch_markers" USING "btree" ("loinc_code");



CREATE INDEX "dutch_markers_name_idx" ON "public"."dutch_markers" USING "btree" ("name");



CREATE INDEX "dutch_markers_panel_id_idx" ON "public"."dutch_markers" USING "btree" ("panel_id");



CREATE INDEX "dutch_markers_parent_id_idx" ON "public"."dutch_markers" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "dutch_reference_ranges_biomarker_id_unit_sex_coalesce_coale_idx" ON "public"."dutch_reference_ranges" USING "btree" ("biomarker_id", "unit", "sex", COALESCE("age_min", '-1'::integer), COALESCE("age_max", '-1'::integer), "range_type");



CREATE INDEX "dutch_reference_ranges_biomarker_id_unit_sex_phase_idx" ON "public"."dutch_reference_ranges" USING "btree" ("biomarker_id", "unit", "sex", "phase");



CREATE INDEX "dutch_reference_ranges_verified_at_idx" ON "public"."dutch_reference_ranges" USING "btree" ("verified_at") WHERE ("verified_at" IS NOT NULL);



CREATE UNIQUE INDEX "dutch_test_results_aggregate_unique" ON "public"."dutch_test_results" USING "btree" ("dutch_test_id", "biomarker_id") WHERE ("timepoint" IS NULL);



CREATE INDEX "dutch_test_results_biomarker_id_idx" ON "public"."dutch_test_results" USING "btree" ("biomarker_id");



CREATE INDEX "dutch_test_results_dutch_test_id_idx" ON "public"."dutch_test_results" USING "btree" ("dutch_test_id");



CREATE INDEX "dutch_tests_test_date_idx" ON "public"."dutch_tests" USING "btree" ("test_date");



CREATE INDEX "dutch_tests_user_id_idx" ON "public"."dutch_tests" USING "btree" ("user_id");



CREATE INDEX "food_logs_custom_food_id_fk_idx" ON "public"."food_logs" USING "btree" ("custom_food_id");



CREATE INDEX "food_logs_recipe_id_fk_idx" ON "public"."food_logs" USING "btree" ("recipe_id");



CREATE INDEX "idx_annotations_user_date" ON "public"."annotations" USING "btree" ("user_id", "date");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_biomarker_descriptions_biomarker_id" ON "public"."biomarker_descriptions" USING "btree" ("biomarker_id");



CREATE INDEX "idx_biomarker_favorites_user_id" ON "public"."biomarker_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_body_log_user_date" ON "public"."body_log_entries" USING "btree" ("user_id", "logged_on" DESC);



CREATE INDEX "idx_chat_doc_extractions_user" ON "public"."chat_document_extractions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_thread" ON "public"."chat_messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "idx_chat_threads_user" ON "public"."chat_threads" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_clinvar_cache_gene" ON "public"."clinvar_cache" USING "btree" ("gene_name");



CREATE INDEX "idx_custom_foods_user" ON "public"."custom_foods" USING "btree" ("user_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_dexa_regions_scan" ON "public"."dexa_regions" USING "btree" ("scan_id");



CREATE INDEX "idx_dexa_scans_user_date" ON "public"."dexa_scans" USING "btree" ("user_id", "scan_date" DESC);



CREATE INDEX "idx_food_logs_submission" ON "public"."food_logs" USING "btree" ("submission_id");



CREATE INDEX "idx_food_logs_user_entry_date" ON "public"."food_logs" USING "btree" ("user_id", "entry_date" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_genetic_profiles_user" ON "public"."genetic_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_impersonation_active" ON "public"."impersonation_sessions" USING "btree" ("target_user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_impersonation_admin" ON "public"."impersonation_sessions" USING "btree" ("admin_user_id", "started_at" DESC);



CREATE INDEX "idx_interpretations_lookup" ON "public"."interpretations" USING "btree" ("user_id", "blood_test_id", "test_result_id", "type");



CREATE INDEX "idx_lab_favorites_user" ON "public"."lab_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_lab_test_biomarkers_biomarker" ON "public"."lab_test_biomarkers" USING "btree" ("biomarker_id");



CREATE INDEX "idx_lab_tests_lab" ON "public"."lab_tests" USING "btree" ("lab_id");



CREATE INDEX "idx_lab_tests_provider" ON "public"."lab_tests" USING "btree" ("provider") WHERE ("provider" IS NOT NULL);



CREATE INDEX "idx_lab_tests_status" ON "public"."lab_tests" USING "btree" ("status");



CREATE INDEX "idx_labs_status" ON "public"."labs" USING "btree" ("status");



CREATE INDEX "idx_marker_suggestions_created_at" ON "public"."marker_suggestions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_marker_suggestions_status" ON "public"."marker_suggestions" USING "btree" ("status");



CREATE INDEX "idx_marker_suggestions_user_id" ON "public"."marker_suggestions" USING "btree" ("user_id");



CREATE INDEX "idx_microbiome_results_taxon" ON "public"."microbiome_results" USING "btree" ("taxon_id");



CREATE INDEX "idx_microbiome_results_test" ON "public"."microbiome_results" USING "btree" ("microbiome_test_id");



CREATE INDEX "idx_microbiome_scores_test" ON "public"."microbiome_scores" USING "btree" ("microbiome_test_id");



CREATE INDEX "idx_microbiome_taxa_parent" ON "public"."microbiome_taxa" USING "btree" ("parent_id");



CREATE INDEX "idx_microbiome_taxa_rank" ON "public"."microbiome_taxa" USING "btree" ("rank");



CREATE INDEX "idx_microbiome_tests_user_date" ON "public"."microbiome_tests" USING "btree" ("user_id", "test_date" DESC);



CREATE INDEX "idx_nevo_search" ON "public"."nevo_foods" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_next_to_test_list" ON "public"."next_to_test" USING "btree" ("list_id");



CREATE UNIQUE INDEX "idx_next_to_test_list_biomarker" ON "public"."next_to_test" USING "btree" ("list_id", "biomarker_id") WHERE ("biomarker_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_next_to_test_list_lab_test" ON "public"."next_to_test" USING "btree" ("list_id", "lab_test_id") WHERE ("lab_test_id" IS NOT NULL);



CREATE INDEX "idx_next_to_test_list_status_created" ON "public"."next_to_test" USING "btree" ("list_id", "status", "created_at" DESC);



CREATE INDEX "idx_next_to_test_list_test_type" ON "public"."next_to_test" USING "btree" ("list_id", "test_type");



CREATE INDEX "idx_next_to_test_lists_user" ON "public"."next_to_test_lists" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_next_to_test_lists_user_name_ci" ON "public"."next_to_test_lists" USING "btree" ("user_id", "lower"("name"));



CREATE INDEX "idx_next_to_test_user_status" ON "public"."next_to_test" USING "btree" ("user_id", "status");



CREATE INDEX "idx_recipe_ingredients_recipe" ON "public"."recipe_ingredients" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipes_user" ON "public"."recipes" USING "btree" ("user_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_rna_expressions_test" ON "public"."rna_expressions" USING "btree" ("rna_test_id");



CREATE INDEX "idx_rna_tests_user" ON "public"."rna_tests" USING "btree" ("user_id", "test_date" DESC);



CREATE INDEX "idx_scrape_jobs_lab" ON "public"."scrape_jobs" USING "btree" ("lab_id", "created_at" DESC);



CREATE INDEX "idx_scrape_jobs_status" ON "public"."scrape_jobs" USING "btree" ("status");



CREATE INDEX "idx_snp_variants_rsid" ON "public"."snp_variants" USING "btree" ("rsid");



CREATE INDEX "idx_supplement_intakes_supplement" ON "public"."supplement_intakes" USING "btree" ("supplement_id");



CREATE INDEX "idx_supplement_intakes_user_time" ON "public"."supplement_intakes" USING "btree" ("user_id", "time_of_day");



CREATE INDEX "idx_supplements_user_start_date" ON "public"."supplements" USING "btree" ("user_id", "start_date");



CREATE INDEX "idx_user_unit_preferences_user_id" ON "public"."user_unit_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_wishlist_items_user" ON "public"."wishlist_items" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_wishlist_sources_item" ON "public"."wishlist_sources" USING "btree" ("item_id");



CREATE INDEX "interpretations_blood_test_id_fk_idx" ON "public"."interpretations" USING "btree" ("blood_test_id");



CREATE INDEX "interpretations_test_result_id_fk_idx" ON "public"."interpretations" USING "btree" ("test_result_id");



CREATE INDEX "lab_favorites_lab_id_fk_idx" ON "public"."lab_favorites" USING "btree" ("lab_id");



CREATE UNIQUE INDEX "lab_tests_lab_name_unique_approved" ON "public"."lab_tests" USING "btree" ("lab_id", "lower"("name")) WHERE ("status" = 'approved'::"text");



CREATE INDEX "lab_tests_reviewed_by_fk_idx" ON "public"."lab_tests" USING "btree" ("reviewed_by");



CREATE INDEX "lab_tests_submitted_by_fk_idx" ON "public"."lab_tests" USING "btree" ("submitted_by");



CREATE UNIQUE INDEX "labs_name_unique_idx" ON "public"."labs" USING "btree" ("lower"("btrim"("name")));



CREATE INDEX "labs_reviewed_by_fk_idx" ON "public"."labs" USING "btree" ("reviewed_by");



CREATE INDEX "labs_submitted_by_fk_idx" ON "public"."labs" USING "btree" ("submitted_by");



CREATE UNIQUE INDEX "labs_website_unique_idx" ON "public"."labs" USING "btree" ("lower"("btrim"("website"))) WHERE (("website" IS NOT NULL) AND ("btrim"("website") <> ''::"text"));



CREATE INDEX "loinc_terms_classtype_status_idx" ON "public"."loinc_terms" USING "btree" ("classtype", "status");



CREATE INDEX "marker_suggestions_created_biomarker_id_fk_idx" ON "public"."marker_suggestions" USING "btree" ("created_biomarker_id");



CREATE INDEX "marker_suggestions_reviewed_by_fk_idx" ON "public"."marker_suggestions" USING "btree" ("reviewed_by");



CREATE INDEX "medical_conditions_user_id_idx" ON "public"."medical_conditions" USING "btree" ("user_id", "start_date" DESC NULLS LAST);



CREATE INDEX "next_to_test_biomarker_id_fk_idx" ON "public"."next_to_test" USING "btree" ("biomarker_id");



CREATE INDEX "next_to_test_lab_test_id_fk_idx" ON "public"."next_to_test" USING "btree" ("lab_test_id");



CREATE INDEX "other_test_values_test_idx" ON "public"."other_test_values" USING "btree" ("test_id");



CREATE INDEX "other_tests_user_date_idx" ON "public"."other_tests" USING "btree" ("user_id", "test_date" DESC);



CREATE INDEX "panels_system_id_idx" ON "public"."panels" USING "btree" ("system_id");



CREATE INDEX "recipe_ingredients_custom_food_id_fk_idx" ON "public"."recipe_ingredients" USING "btree" ("custom_food_id");



CREATE INDEX "reference_ranges_biomarker_idx" ON "public"."reference_ranges" USING "btree" ("biomarker_id", "unit", "sex", "phase");



CREATE UNIQUE INDEX "reference_ranges_unique_idx" ON "public"."reference_ranges" USING "btree" ("biomarker_id", "unit", "sex", COALESCE("age_min", '-1'::integer), COALESCE("age_max", '-1'::integer), "range_type");



CREATE INDEX "reference_ranges_verified_by_fk_idx" ON "public"."reference_ranges" USING "btree" ("verified_by");



CREATE INDEX "reference_ranges_verified_idx" ON "public"."reference_ranges" USING "btree" ("verified_at") WHERE ("verified_at" IS NOT NULL);



CREATE INDEX "rmr_tests_user_date_idx" ON "public"."rmr_tests" USING "btree" ("user_id", "test_date" DESC);



CREATE INDEX "snp_variants_profile_category_idx" ON "public"."snp_variants" USING "btree" ("genetic_profile_id", "category");



CREATE INDEX "test_results_biomarker_id_idx" ON "public"."test_results" USING "btree" ("biomarker_id");



CREATE INDEX "test_results_blood_test_id_idx" ON "public"."test_results" USING "btree" ("blood_test_id");



CREATE INDEX "user_unit_preferences_biomarker_id_fk_idx" ON "public"."user_unit_preferences" USING "btree" ("biomarker_id");



CREATE INDEX "wishlist_sources_user_id_fk_idx" ON "public"."wishlist_sources" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_blood_test_updated" BEFORE UPDATE ON "public"."blood_tests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_custom_food_updated" BEFORE UPDATE ON "public"."custom_foods" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_dutch_test_updated" BEFORE UPDATE ON "public"."dutch_tests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_food_log_updated" BEFORE UPDATE ON "public"."food_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_medical_conditions_updated" BEFORE UPDATE ON "public"."medical_conditions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_profile_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_recipe_updated" BEFORE UPDATE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_next_to_test_lists_updated" BEFORE UPDATE ON "public"."next_to_test_lists" FOR EACH ROW EXECUTE FUNCTION "public"."next_to_test_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_next_to_test_updated" BEFORE UPDATE ON "public"."next_to_test" FOR EACH ROW EXECUTE FUNCTION "public"."next_to_test_touch_updated_at"();



ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."biomarker_descriptions"
    ADD CONSTRAINT "biomarker_descriptions_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarker_favorites"
    ADD CONSTRAINT "biomarker_favorites_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarker_favorites"
    ADD CONSTRAINT "biomarker_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarker_units"
    ADD CONSTRAINT "biomarker_units_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "public"."panels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."biomarkers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blood_tests"
    ADD CONSTRAINT "blood_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."body_goals"
    ADD CONSTRAINT "body_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."body_log_entries"
    ADD CONSTRAINT "body_log_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_document_extractions"
    ADD CONSTRAINT "chat_document_extractions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_document_extractions"
    ADD CONSTRAINT "chat_document_extractions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_memory_files"
    ADD CONSTRAINT "chat_memory_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_threads"
    ADD CONSTRAINT "chat_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_foods"
    ADD CONSTRAINT "custom_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dexa_regions"
    ADD CONSTRAINT "dexa_regions_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "public"."dexa_scans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dexa_scans"
    ADD CONSTRAINT "dexa_scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_computed_values"
    ADD CONSTRAINT "dutch_computed_values_dutch_test_id_fkey" FOREIGN KEY ("dutch_test_id") REFERENCES "public"."dutch_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_marker_descriptions"
    ADD CONSTRAINT "dutch_marker_descriptions_marker_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."dutch_markers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_marker_units"
    ADD CONSTRAINT "dutch_marker_units_marker_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."dutch_markers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_reference_ranges"
    ADD CONSTRAINT "dutch_reference_ranges_marker_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."dutch_markers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_test_results"
    ADD CONSTRAINT "dutch_test_results_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."dutch_markers"("id");



ALTER TABLE ONLY "public"."dutch_test_results"
    ADD CONSTRAINT "dutch_test_results_dutch_test_id_fkey" FOREIGN KEY ("dutch_test_id") REFERENCES "public"."dutch_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_tests"
    ADD CONSTRAINT "dutch_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_custom_food_id_fkey" FOREIGN KEY ("custom_food_id") REFERENCES "public"."custom_foods"("id");



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."genetic_profiles"
    ADD CONSTRAINT "genetic_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interpretations"
    ADD CONSTRAINT "interpretations_blood_test_id_fkey" FOREIGN KEY ("blood_test_id") REFERENCES "public"."blood_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interpretations"
    ADD CONSTRAINT "interpretations_test_result_id_fkey" FOREIGN KEY ("test_result_id") REFERENCES "public"."test_results"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interpretations"
    ADD CONSTRAINT "interpretations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_favorites"
    ADD CONSTRAINT "lab_favorites_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_favorites"
    ADD CONSTRAINT "lab_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_test_biomarkers"
    ADD CONSTRAINT "lab_test_biomarkers_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_test_biomarkers"
    ADD CONSTRAINT "lab_test_biomarkers_lab_test_id_fkey" FOREIGN KEY ("lab_test_id") REFERENCES "public"."lab_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."labs"
    ADD CONSTRAINT "labs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."labs"
    ADD CONSTRAINT "labs_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loinc_display"
    ADD CONSTRAINT "loinc_display_loinc_num_fkey" FOREIGN KEY ("loinc_num") REFERENCES "public"."loinc_terms"("loinc_num") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marker_suggestions"
    ADD CONSTRAINT "marker_suggestions_created_biomarker_id_fkey" FOREIGN KEY ("created_biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marker_suggestions"
    ADD CONSTRAINT "marker_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."marker_suggestions"
    ADD CONSTRAINT "marker_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_conditions"
    ADD CONSTRAINT "medical_conditions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microbiome_results"
    ADD CONSTRAINT "microbiome_results_microbiome_test_id_fkey" FOREIGN KEY ("microbiome_test_id") REFERENCES "public"."microbiome_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microbiome_results"
    ADD CONSTRAINT "microbiome_results_taxon_id_fkey" FOREIGN KEY ("taxon_id") REFERENCES "public"."microbiome_taxa"("id");



ALTER TABLE ONLY "public"."microbiome_scores"
    ADD CONSTRAINT "microbiome_scores_microbiome_test_id_fkey" FOREIGN KEY ("microbiome_test_id") REFERENCES "public"."microbiome_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microbiome_taxa"
    ADD CONSTRAINT "microbiome_taxa_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."microbiome_taxa"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."microbiome_tests"
    ADD CONSTRAINT "microbiome_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."next_to_test"
    ADD CONSTRAINT "next_to_test_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."next_to_test"
    ADD CONSTRAINT "next_to_test_lab_test_id_fkey" FOREIGN KEY ("lab_test_id") REFERENCES "public"."lab_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."next_to_test"
    ADD CONSTRAINT "next_to_test_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."next_to_test_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."next_to_test_lists"
    ADD CONSTRAINT "next_to_test_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."next_to_test"
    ADD CONSTRAINT "next_to_test_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."other_test_values"
    ADD CONSTRAINT "other_test_values_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."other_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."other_tests"
    ADD CONSTRAINT "other_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."panels"
    ADD CONSTRAINT "panels_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_custom_food_id_fkey" FOREIGN KEY ("custom_food_id") REFERENCES "public"."custom_foods"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reference_ranges"
    ADD CONSTRAINT "reference_ranges_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reference_ranges"
    ADD CONSTRAINT "reference_ranges_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rmr_tests"
    ADD CONSTRAINT "rmr_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rna_expressions"
    ADD CONSTRAINT "rna_expressions_rna_test_id_fkey" FOREIGN KEY ("rna_test_id") REFERENCES "public"."rna_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rna_tests"
    ADD CONSTRAINT "rna_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scrape_jobs"
    ADD CONSTRAINT "scrape_jobs_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snp_variants"
    ADD CONSTRAINT "snp_variants_genetic_profile_id_fkey" FOREIGN KEY ("genetic_profile_id") REFERENCES "public"."genetic_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_intakes"
    ADD CONSTRAINT "supplement_intakes_supplement_id_fkey" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_intakes"
    ADD CONSTRAINT "supplement_intakes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplements"
    ADD CONSTRAINT "supplements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_results"
    ADD CONSTRAINT "test_results_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id");



ALTER TABLE ONLY "public"."test_results"
    ADD CONSTRAINT "test_results_blood_test_id_fkey" FOREIGN KEY ("blood_test_id") REFERENCES "public"."blood_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_unit_preferences"
    ADD CONSTRAINT "user_unit_preferences_biomarker_id_fkey" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_unit_preferences"
    ADD CONSTRAINT "user_unit_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_sources"
    ADD CONSTRAINT "wishlist_sources_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."wishlist_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_sources"
    ADD CONSTRAINT "wishlist_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage taxa" ON "public"."microbiome_taxa" TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")) WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update suggestions" ON "public"."marker_suggestions" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")) WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all suggestions" ON "public"."marker_suggestions" FOR SELECT TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Anyone can read taxa" ON "public"."microbiome_taxa" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read nevo" ON "public"."nevo_foods" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Biomarker units viewable by authenticated" ON "public"."biomarker_units" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Biomarkers are viewable by authenticated users" ON "public"."biomarkers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Descriptions viewable by authenticated" ON "public"."biomarker_descriptions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dutch descriptions viewable by authenticated" ON "public"."dutch_marker_descriptions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dutch marker units viewable by authenticated" ON "public"."dutch_marker_units" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dutch markers viewable by authenticated" ON "public"."dutch_markers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dutch reference ranges viewable by authenticated" ON "public"."dutch_reference_ranges" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Manage own lab favorites" ON "public"."lab_favorites" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Manage own next-to-test entries" ON "public"."next_to_test" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Manage own next-to-test lists" ON "public"."next_to_test_lists" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Panels viewable by authenticated" ON "public"."panels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Reference ranges viewable by authenticated" ON "public"."reference_ranges" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Systems viewable by authenticated" ON "public"."systems" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can delete own favorites" ON "public"."biomarker_favorites" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own unit preferences" ON "public"."user_unit_preferences" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their medical conditions" ON "public"."medical_conditions" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own favorites" ON "public"."biomarker_favorites" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own unit preferences" ON "public"."user_unit_preferences" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert suggestions" ON "public"."marker_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their medical conditions" ON "public"."medical_conditions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read their microbiome results" ON "public"."microbiome_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_results"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can read their microbiome scores" ON "public"."microbiome_scores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_scores"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can read their microbiome tests" ON "public"."microbiome_tests" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own unit preferences" ON "public"."user_unit_preferences" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their medical conditions" ON "public"."medical_conditions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own annotations" ON "public"."annotations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own favorites" ON "public"."biomarker_favorites" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own interpretations" ON "public"."interpretations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own suggestions" ON "public"."marker_suggestions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own supplements" ON "public"."supplements" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own unit preferences" ON "public"."user_unit_preferences" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their medical conditions" ON "public"."medical_conditions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own blood tests" ON "public"."blood_tests" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own dutch computed values" ON "public"."dutch_computed_values" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dutch_tests"
  WHERE (("dutch_tests"."id" = "dutch_computed_values"."dutch_test_id") AND ("dutch_tests"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their own dutch test results" ON "public"."dutch_test_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dutch_tests"
  WHERE (("dutch_tests"."id" = "dutch_test_results"."dutch_test_id") AND ("dutch_tests"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their own dutch tests" ON "public"."dutch_tests" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own test results" ON "public"."test_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."blood_tests"
  WHERE (("blood_tests"."id" = "test_results"."blood_test_id") AND ("blood_tests"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can write their microbiome results" ON "public"."microbiome_results" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_results"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_results"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can write their microbiome scores" ON "public"."microbiome_scores" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_scores"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."microbiome_tests" "t"
  WHERE (("t"."id" = "microbiome_scores"."microbiome_test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can write their microbiome tests" ON "public"."microbiome_tests" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users delete own chat extractions" ON "public"."chat_document_extractions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users insert own chat extractions" ON "public"."chat_document_extractions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own custom foods" ON "public"."custom_foods" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own memory" ON "public"."chat_memory_files" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own recipe ingredients" ON "public"."recipe_ingredients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recipes" "r"
  WHERE (("r"."id" = "recipe_ingredients"."recipe_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."recipes" "r"
  WHERE (("r"."id" = "recipe_ingredients"."recipe_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users manage own recipes" ON "public"."recipes" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own supplement intakes" ON "public"."supplement_intakes" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own wishlist items" ON "public"."wishlist_items" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own wishlist sources" ON "public"."wishlist_sources" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users read their body goals" ON "public"."body_goals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users read their body log" ON "public"."body_log_entries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users read their dexa regions" ON "public"."dexa_regions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dexa_scans" "s"
  WHERE (("s"."id" = "dexa_regions"."scan_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users read their dexa scans" ON "public"."dexa_scans" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users read their food logs" ON "public"."food_logs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own RNA expressions" ON "public"."rna_expressions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rna_tests"
  WHERE (("rna_tests"."id" = "rna_expressions"."rna_test_id") AND ("rna_tests"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users view own RNA tests" ON "public"."rna_tests" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own SNP variants" ON "public"."snp_variants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."genetic_profiles"
  WHERE (("genetic_profiles"."id" = "snp_variants"."genetic_profile_id") AND ("genetic_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users view own chat extractions" ON "public"."chat_document_extractions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own genetic profiles" ON "public"."genetic_profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own messages" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_threads"
  WHERE (("chat_threads"."id" = "chat_messages"."thread_id") AND ("chat_threads"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users view own threads" ON "public"."chat_threads" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users write their body goals" ON "public"."body_goals" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users write their body log" ON "public"."body_log_entries" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users write their dexa regions" ON "public"."dexa_regions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dexa_scans" "s"
  WHERE (("s"."id" = "dexa_regions"."scan_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dexa_scans" "s"
  WHERE (("s"."id" = "dexa_regions"."scan_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users write their dexa scans" ON "public"."dexa_scans" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users write their food logs" ON "public"."food_logs" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "View approved lab tests" ON "public"."lab_tests" FOR SELECT TO "authenticated" USING (("status" = 'approved'::"text"));



CREATE POLICY "View approved lab_test_biomarkers" ON "public"."lab_test_biomarkers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lab_tests" "t"
  WHERE (("t"."id" = "lab_test_biomarkers"."lab_test_id") AND ("t"."status" = 'approved'::"text")))));



CREATE POLICY "View approved labs" ON "public"."labs" FOR SELECT TO "authenticated" USING (("status" = 'approved'::"text"));



ALTER TABLE "public"."ai_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biomarker_descriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biomarker_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biomarker_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biomarkers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blood_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_document_extractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_memory_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_foods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dexa_regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dexa_scans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_computed_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_marker_descriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_marker_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_markers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_reference_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_test_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dutch_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."genetic_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interpretations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_test_biomarkers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loinc_display" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loinc_display_read_all" ON "public"."loinc_display" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."loinc_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loinc_terms_read_all" ON "public"."loinc_terms" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."marker_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."microbiome_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."microbiome_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."microbiome_taxa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."microbiome_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nevo_foods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."next_to_test" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."next_to_test_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."other_test_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "other_test_values_delete_own" ON "public"."other_test_values" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."other_tests" "t"
  WHERE (("t"."id" = "other_test_values"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "other_test_values_insert_own" ON "public"."other_test_values" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."other_tests" "t"
  WHERE (("t"."id" = "other_test_values"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "other_test_values_select_own" ON "public"."other_test_values" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."other_tests" "t"
  WHERE (("t"."id" = "other_test_values"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "other_test_values_update_own" ON "public"."other_test_values" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."other_tests" "t"
  WHERE (("t"."id" = "other_test_values"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."other_tests" "t"
  WHERE (("t"."id" = "other_test_values"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."other_tests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "other_tests_delete_own" ON "public"."other_tests" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "other_tests_insert_own" ON "public"."other_tests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "other_tests_select_own" ON "public"."other_tests" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "other_tests_update_own" ON "public"."other_tests" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."panels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reference_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rmr_tests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rmr_tests_delete_own" ON "public"."rmr_tests" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "rmr_tests_insert_own" ON "public"."rmr_tests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "rmr_tests_select_own" ON "public"."rmr_tests" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "rmr_tests_update_own" ON "public"."rmr_tests" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."rna_expressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rna_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scrape_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snp_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplement_intakes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."systems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_unit_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_sources" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_next_to_test_move"("p_list_id" "uuid", "p_move_ids" "uuid"[], "p_patches" "jsonb", "p_delete_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_next_to_test_move"("p_list_id" "uuid", "p_move_ids" "uuid"[], "p_patches" "jsonb", "p_delete_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_next_to_test_move"("p_list_id" "uuid", "p_move_ids" "uuid"[], "p_patches" "jsonb", "p_delete_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."scrape_jobs" TO "anon";
GRANT ALL ON TABLE "public"."scrape_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."scrape_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_latest_scrape_jobs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_latest_scrape_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."next_to_test_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."next_to_test_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_to_test_touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."nevo_foods" TO "anon";
GRANT ALL ON TABLE "public"."nevo_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."nevo_foods" TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_nevo"("q" "text", "max_results" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_nevo"("q" "text", "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_nevo"("q" "text", "max_results" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."take_ai_request"("p_user_id" "uuid", "p_per_hour" integer, "p_per_day" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."take_ai_request"("p_user_id" "uuid", "p_per_hour" integer, "p_per_day" integer) TO "service_role";



GRANT ALL ON TABLE "public"."ai_requests" TO "anon";
GRANT ALL ON TABLE "public"."ai_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."annotations" TO "anon";
GRANT ALL ON TABLE "public"."annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."biomarker_descriptions" TO "anon";
GRANT ALL ON TABLE "public"."biomarker_descriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarker_descriptions" TO "service_role";



GRANT ALL ON TABLE "public"."biomarker_favorites" TO "anon";
GRANT ALL ON TABLE "public"."biomarker_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarker_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."biomarker_units" TO "anon";
GRANT ALL ON TABLE "public"."biomarker_units" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarker_units" TO "service_role";



GRANT ALL ON TABLE "public"."biomarkers" TO "anon";
GRANT ALL ON TABLE "public"."biomarkers" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarkers" TO "service_role";



GRANT ALL ON TABLE "public"."blood_tests" TO "anon";
GRANT ALL ON TABLE "public"."blood_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."blood_tests" TO "service_role";



GRANT ALL ON TABLE "public"."body_goals" TO "anon";
GRANT ALL ON TABLE "public"."body_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."body_goals" TO "service_role";



GRANT ALL ON TABLE "public"."body_log_entries" TO "anon";
GRANT ALL ON TABLE "public"."body_log_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."body_log_entries" TO "service_role";



GRANT ALL ON TABLE "public"."chat_document_extractions" TO "anon";
GRANT ALL ON TABLE "public"."chat_document_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_document_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_memory_files" TO "anon";
GRANT ALL ON TABLE "public"."chat_memory_files" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_memory_files" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_threads" TO "anon";
GRANT ALL ON TABLE "public"."chat_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_threads" TO "service_role";



GRANT ALL ON TABLE "public"."clinvar_cache" TO "anon";
GRANT ALL ON TABLE "public"."clinvar_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."clinvar_cache" TO "service_role";



GRANT ALL ON TABLE "public"."custom_foods" TO "anon";
GRANT ALL ON TABLE "public"."custom_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_foods" TO "service_role";



GRANT ALL ON TABLE "public"."dexa_regions" TO "anon";
GRANT ALL ON TABLE "public"."dexa_regions" TO "authenticated";
GRANT ALL ON TABLE "public"."dexa_regions" TO "service_role";



GRANT ALL ON TABLE "public"."dexa_scans" TO "anon";
GRANT ALL ON TABLE "public"."dexa_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."dexa_scans" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_computed_values" TO "anon";
GRANT ALL ON TABLE "public"."dutch_computed_values" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_computed_values" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_marker_descriptions" TO "anon";
GRANT ALL ON TABLE "public"."dutch_marker_descriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_marker_descriptions" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_marker_units" TO "anon";
GRANT ALL ON TABLE "public"."dutch_marker_units" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_marker_units" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_markers" TO "anon";
GRANT ALL ON TABLE "public"."dutch_markers" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_markers" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_reference_ranges" TO "anon";
GRANT ALL ON TABLE "public"."dutch_reference_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_reference_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_test_results" TO "anon";
GRANT ALL ON TABLE "public"."dutch_test_results" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_test_results" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_tests" TO "anon";
GRANT ALL ON TABLE "public"."dutch_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_tests" TO "service_role";



GRANT ALL ON TABLE "public"."food_logs" TO "anon";
GRANT ALL ON TABLE "public"."food_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."food_logs" TO "service_role";



GRANT ALL ON TABLE "public"."genetic_profiles" TO "anon";
GRANT ALL ON TABLE "public"."genetic_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."genetic_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."interpretations" TO "anon";
GRANT ALL ON TABLE "public"."interpretations" TO "authenticated";
GRANT ALL ON TABLE "public"."interpretations" TO "service_role";



GRANT ALL ON TABLE "public"."lab_favorites" TO "anon";
GRANT ALL ON TABLE "public"."lab_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."lab_test_biomarkers" TO "anon";
GRANT ALL ON TABLE "public"."lab_test_biomarkers" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_test_biomarkers" TO "service_role";



GRANT ALL ON TABLE "public"."lab_tests" TO "anon";
GRANT ALL ON TABLE "public"."lab_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_tests" TO "service_role";



GRANT ALL ON TABLE "public"."labs" TO "anon";
GRANT ALL ON TABLE "public"."labs" TO "authenticated";
GRANT ALL ON TABLE "public"."labs" TO "service_role";



GRANT ALL ON TABLE "public"."loinc_display" TO "anon";
GRANT ALL ON TABLE "public"."loinc_display" TO "authenticated";
GRANT ALL ON TABLE "public"."loinc_display" TO "service_role";



GRANT ALL ON TABLE "public"."loinc_terms" TO "anon";
GRANT ALL ON TABLE "public"."loinc_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."loinc_terms" TO "service_role";



GRANT ALL ON TABLE "public"."marker_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."marker_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."marker_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."microbiome_results" TO "anon";
GRANT ALL ON TABLE "public"."microbiome_results" TO "authenticated";
GRANT ALL ON TABLE "public"."microbiome_results" TO "service_role";



GRANT ALL ON TABLE "public"."microbiome_scores" TO "anon";
GRANT ALL ON TABLE "public"."microbiome_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."microbiome_scores" TO "service_role";



GRANT ALL ON TABLE "public"."microbiome_taxa" TO "anon";
GRANT ALL ON TABLE "public"."microbiome_taxa" TO "authenticated";
GRANT ALL ON TABLE "public"."microbiome_taxa" TO "service_role";



GRANT ALL ON TABLE "public"."microbiome_tests" TO "anon";
GRANT ALL ON TABLE "public"."microbiome_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."microbiome_tests" TO "service_role";



GRANT ALL ON TABLE "public"."next_to_test" TO "anon";
GRANT ALL ON TABLE "public"."next_to_test" TO "authenticated";
GRANT ALL ON TABLE "public"."next_to_test" TO "service_role";



GRANT ALL ON TABLE "public"."next_to_test_lists" TO "anon";
GRANT ALL ON TABLE "public"."next_to_test_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."next_to_test_lists" TO "service_role";



GRANT ALL ON TABLE "public"."other_test_values" TO "anon";
GRANT ALL ON TABLE "public"."other_test_values" TO "authenticated";
GRANT ALL ON TABLE "public"."other_test_values" TO "service_role";



GRANT ALL ON TABLE "public"."other_tests" TO "anon";
GRANT ALL ON TABLE "public"."other_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."other_tests" TO "service_role";



GRANT ALL ON TABLE "public"."panels" TO "anon";
GRANT ALL ON TABLE "public"."panels" TO "authenticated";
GRANT ALL ON TABLE "public"."panels" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."reference_ranges" TO "anon";
GRANT ALL ON TABLE "public"."reference_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."reference_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."rmr_tests" TO "anon";
GRANT ALL ON TABLE "public"."rmr_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."rmr_tests" TO "service_role";



GRANT ALL ON TABLE "public"."rna_expressions" TO "anon";
GRANT ALL ON TABLE "public"."rna_expressions" TO "authenticated";
GRANT ALL ON TABLE "public"."rna_expressions" TO "service_role";



GRANT ALL ON TABLE "public"."rna_tests" TO "anon";
GRANT ALL ON TABLE "public"."rna_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."rna_tests" TO "service_role";



GRANT ALL ON TABLE "public"."snp_variants" TO "anon";
GRANT ALL ON TABLE "public"."snp_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."snp_variants" TO "service_role";



GRANT ALL ON TABLE "public"."supplement_intakes" TO "anon";
GRANT ALL ON TABLE "public"."supplement_intakes" TO "authenticated";
GRANT ALL ON TABLE "public"."supplement_intakes" TO "service_role";



GRANT ALL ON TABLE "public"."supplements" TO "anon";
GRANT ALL ON TABLE "public"."supplements" TO "authenticated";
GRANT ALL ON TABLE "public"."supplements" TO "service_role";



GRANT ALL ON TABLE "public"."systems" TO "anon";
GRANT ALL ON TABLE "public"."systems" TO "authenticated";
GRANT ALL ON TABLE "public"."systems" TO "service_role";



GRANT ALL ON TABLE "public"."test_results" TO "anon";
GRANT ALL ON TABLE "public"."test_results" TO "authenticated";
GRANT ALL ON TABLE "public"."test_results" TO "service_role";



GRANT ALL ON TABLE "public"."user_unit_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_unit_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_unit_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_items" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_sources" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_sources" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ---------------------------------------------------------------------------
-- Outside the public schema (not part of the dump above)
-- ---------------------------------------------------------------------------

-- A profile row for every new auth user.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage buckets. Lab reports and chat uploads go through the service role;
-- meal photos are read and written by their owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lab-pdfs', 'lab-pdfs', false, 33554432,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('meal-photos', 'meal-photos', false, null, null)
on conflict (id) do nothing;

drop policy if exists "meal-photos owner insert" on storage.objects;
create policy "meal-photos owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "meal-photos owner read" on storage.objects;
create policy "meal-photos owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Function access as on production. New functions in a Supabase project get
-- EXECUTE for anon and authenticated by default; these must not.
revoke all on function public.apply_next_to_test_move(uuid, uuid[], jsonb, uuid[]) from public, anon;
revoke all on function public.get_latest_scrape_jobs() from public, anon, authenticated;
revoke all on function public.search_nevo(text, integer) from public, anon;
revoke all on function public.take_ai_request(uuid, integer, integer) from public, anon, authenticated;
