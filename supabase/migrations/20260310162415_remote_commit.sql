


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_register_operator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  public_club_id UUID;
BEGIN
  -- 1. Check if this operator is already in ANY club roster
  -- If they are, we don't need to do anything.
  IF NOT EXISTS (SELECT 1 FROM public.club_roster WHERE callsign = NEW.operator_callsign) THEN
    
    -- 2. Get the ID of the 'Public Club' (created in previous step)
    SELECT id INTO public_club_id FROM public.clubs WHERE name = 'Public Club' LIMIT 1;
    
    -- 3. Insert them into the Public Club roster
    IF public_club_id IS NOT NULL THEN
      INSERT INTO public.club_roster (club_id, callsign)
      VALUES (public_club_id, NEW.operator_callsign)
      ON CONFLICT DO NOTHING; -- Prevent race conditions
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_register_operator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_distance"("lat1" numeric, "lon1" numeric, "lat2" numeric, "lon2" numeric) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Returns distance in kilometers
  RETURN ST_Distance(
    ST_MakePoint(lon1, lat1)::geography,
    ST_MakePoint(lon2, lat2)::geography
  ) / 1000;
END;
$$;


ALTER FUNCTION "public"."calculate_distance"("lat1" numeric, "lon1" numeric, "lat2" numeric, "lon2" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_data"("hours_retention" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  deleted_contacts int;
  deleted_stats int;
begin
  -- 1. Delete contacts older than the retention period
  delete from public.contacts 
  where created_at < now() - (hours_retention || ' hours')::interval;
  
  get diagnostics deleted_contacts = row_count;

  -- 2. Delete stats where the stat_date is older than the retention period
  delete from public.contact_stats
  where stat_date < (now() - (hours_retention || ' hours')::interval)::date;
  
  get diagnostics deleted_stats = row_count;

  -- 3. Return a summary of what was deleted
  return jsonb_build_object('contacts_deleted', deleted_contacts, 'stats_deleted', deleted_stats);
end;
$$;


ALTER FUNCTION "public"."cleanup_old_data"("hours_retention" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "callsign" character varying(20) NOT NULL,
    "contacted_callsign" character varying(20) NOT NULL,
    "qso_date" "date" NOT NULL,
    "time_on" time without time zone NOT NULL,
    "time_off" time without time zone,
    "band" character varying(10),
    "mode" character varying(20),
    "frequency" numeric(10,6),
    "rst_sent" character varying(10),
    "rst_rcvd" character varying(10),
    "tx_power" integer,
    "gridsquare" character varying(10),
    "country" character varying(100),
    "dxcc" integer,
    "state" character varying(50),
    "county" character varying(100),
    "location" "extensions"."geography"(Point,4326),
    "my_gridsquare" character varying(10),
    "my_country" character varying(100),
    "my_state" character varying(50),
    "my_location" "extensions"."geography"(Point,4326),
    "operator_callsign" character varying(20) NOT NULL,
    "station_callsign" character varying(20),
    "logger_software" character varying(50),
    "comment" "text",
    "notes" "text",
    "qsl_sent" character varying(1),
    "qsl_rcvd" character varying(1),
    "lotw_sent" character varying(1),
    "lotw_rcvd" character varying(1),
    "contest_id" character varying(50),
    "srx" integer,
    "stx" integer,
    "raw_adif" "text",
    CONSTRAINT "valid_frequency" CHECK ((("frequency" >= 0.001) AND ("frequency" <= (300000)::numeric))),
    CONSTRAINT "valid_power" CHECK ((("tx_power" >= 0) AND ("tx_power" <= 2000)))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contacts" IS 'Main table storing all QSO contacts';



COMMENT ON COLUMN "public"."contacts"."location" IS 'Geographic location of contacted station (PostGIS)';



COMMENT ON COLUMN "public"."contacts"."my_location" IS 'Geographic location of operator (PostGIS)';



CREATE OR REPLACE FUNCTION "public"."get_display_logs"("filter_mode" "text", "filter_value" "text") RETURNS SETOF "public"."contacts"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select * from contacts
  where
    case
      -- If mode is Club, match any operator in that club's roster
      when filter_mode = 'club' then
        operator_callsign in (
          select callsign from club_roster 
          where club_id = filter_value::uuid
        )
      -- If mode is Self, match the specific callsign
      when filter_mode = 'self' then
        operator_callsign = filter_value
      else false
    end
  order by qso_date desc, time_on desc
  limit 1000;
$$;


ALTER FUNCTION "public"."get_display_logs"("filter_mode" "text", "filter_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) RETURNS SETOF "public"."contacts"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.*
  from contacts c
  where c.operator_callsign in (
    select cr.callsign
    from club_roster cr
    where cr.club_id = any(club_ids)
  )
  order by c.qso_date desc, c.time_on desc
  limit 1000;
$$;


ALTER FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) IS 'Returns contacts for operators in any of the given club rosters. Used when display_config.mode = clubs and club_ids has 1-4 UUIDs.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."location_wkt"("rec" "public"."contacts") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT ST_AsText(rec.location);
$$;


ALTER FUNCTION "public"."location_wkt"("rec" "public"."contacts") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_contacts INTEGER;
  v_unique_callsigns INTEGER;
  v_countries INTEGER;
  v_modes JSONB;
  v_bands JSONB;
BEGIN
  -- Calculate aggregates
  SELECT 
    COUNT(*),
    COUNT(DISTINCT contacted_callsign),
    COUNT(DISTINCT country)
  INTO v_total_contacts, v_unique_callsigns, v_countries
  FROM contacts
  WHERE operator_callsign = NEW.operator_callsign
    AND qso_date = NEW.qso_date;

  -- Calculate modes
  SELECT jsonb_object_agg(mode, cnt)
  INTO v_modes
  FROM (
    SELECT mode, COUNT(*) as cnt
    FROM contacts
    WHERE operator_callsign = NEW.operator_callsign
      AND qso_date = NEW.qso_date
      AND mode IS NOT NULL
    GROUP BY mode
  ) m;

  -- Calculate bands
  SELECT jsonb_object_agg(band, cnt)
  INTO v_bands
  FROM (
    SELECT band, COUNT(*) as cnt
    FROM contacts
    WHERE operator_callsign = NEW.operator_callsign
      AND qso_date = NEW.qso_date
      AND band IS NOT NULL
    GROUP BY band
  ) b;

  INSERT INTO contact_stats (
    stat_date,
    operator_callsign,
    total_contacts,
    unique_callsigns,
    countries,
    modes,
    bands,
    updated_at
  )
  VALUES (
    NEW.qso_date,
    NEW.operator_callsign,
    v_total_contacts,
    v_unique_callsigns,
    v_countries,
    COALESCE(v_modes, '{}'::jsonb),
    COALESCE(v_bands, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (stat_date, operator_callsign) 
  DO UPDATE SET
    total_contacts = EXCLUDED.total_contacts,
    unique_callsigns = EXCLUDED.unique_callsigns,
    countries = EXCLUDED.countries,
    modes = EXCLUDED.modes,
    bands = EXCLUDED.bands,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contact_stats"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_roster" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "callsign" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_roster" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_stats" (
    "id" bigint NOT NULL,
    "stat_date" "date" NOT NULL,
    "operator_callsign" character varying(20) NOT NULL,
    "total_contacts" integer DEFAULT 0,
    "unique_callsigns" integer DEFAULT 0,
    "countries" integer DEFAULT 0,
    "modes" "jsonb",
    "bands" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."contact_stats" IS 'Aggregated statistics for performance';



CREATE SEQUENCE IF NOT EXISTS "public"."contact_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contact_stats_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contact_stats_id_seq" OWNED BY "public"."contact_stats"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contacts_id_seq" OWNED BY "public"."contacts"."id";



CREATE OR REPLACE VIEW "public"."operator_summary" AS
 SELECT "operator_callsign",
    "count"(*) AS "total_contacts",
    "count"(DISTINCT "contacted_callsign") AS "unique_calls",
    "count"(DISTINCT "country") AS "countries",
    "count"(DISTINCT "mode") AS "modes_used",
    "count"(DISTINCT "band") AS "bands_used",
    "min"("created_at") AS "first_contact",
    "max"("created_at") AS "last_contact"
   FROM "public"."contacts"
  GROUP BY "operator_callsign";


ALTER VIEW "public"."operator_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "callsign" "text",
    "display_config" "jsonb" DEFAULT '{"mode": "self"}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'user'::"text",
    CONSTRAINT "callsign_length" CHECK (("char_length"("callsign") >= 3)),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'master_admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."role" IS 'user = normal; master_admin = can manage roster for any club. Future: club_manager per club_managers.';



ALTER TABLE ONLY "public"."contact_stats" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contact_stats_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."contacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."club_roster"
    ADD CONSTRAINT "club_roster_club_id_callsign_key" UNIQUE ("club_id", "callsign");



ALTER TABLE ONLY "public"."club_roster"
    ADD CONSTRAINT "club_roster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_stats"
    ADD CONSTRAINT "contact_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_stats"
    ADD CONSTRAINT "contact_stats_stat_date_operator_callsign_key" UNIQUE ("stat_date", "operator_callsign");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_clubs_name_lower_unique" ON "public"."clubs" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE INDEX "idx_contacts_band" ON "public"."contacts" USING "btree" ("band") WHERE ("band" IS NOT NULL);



CREATE INDEX "idx_contacts_callsign" ON "public"."contacts" USING "btree" ("callsign");



CREATE INDEX "idx_contacts_contacted" ON "public"."contacts" USING "btree" ("contacted_callsign");



CREATE INDEX "idx_contacts_created" ON "public"."contacts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contacts_date_time" ON "public"."contacts" USING "btree" ("qso_date" DESC, "time_on" DESC);



CREATE INDEX "idx_contacts_frequency" ON "public"."contacts" USING "btree" ("frequency") WHERE ("frequency" IS NOT NULL);



CREATE INDEX "idx_contacts_location" ON "public"."contacts" USING "gist" ("location") WHERE ("location" IS NOT NULL);



CREATE INDEX "idx_contacts_mode" ON "public"."contacts" USING "btree" ("mode") WHERE ("mode" IS NOT NULL);



CREATE INDEX "idx_contacts_my_location" ON "public"."contacts" USING "gist" ("my_location") WHERE ("my_location" IS NOT NULL);



CREATE INDEX "idx_contacts_operator" ON "public"."contacts" USING "btree" ("operator_callsign");



CREATE INDEX "idx_contacts_operator_recent" ON "public"."contacts" USING "btree" ("operator_callsign", "created_at" DESC);



CREATE INDEX "idx_contacts_search" ON "public"."contacts" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("comment", ''::"text") || ' '::"text") || COALESCE("notes", ''::"text"))));



CREATE OR REPLACE TRIGGER "on_contact_created" AFTER INSERT ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."auto_register_operator"();



CREATE OR REPLACE TRIGGER "trigger_update_stats" AFTER INSERT ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_contact_stats"();



ALTER TABLE ONLY "public"."club_roster"
    ADD CONSTRAINT "club_roster_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated inserts" ON "public"."contacts" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow authenticated role to insert contacts" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Club owners and master admin can manage roster" ON "public"."club_roster" USING (((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_roster"."club_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'master_admin'::"text")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_roster"."club_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'master_admin'::"text"))))));



CREATE POLICY "Clubs are viewable by everyone" ON "public"."clubs" FOR SELECT USING (true);



CREATE POLICY "Owners and master admin can update clubs" ON "public"."clubs" FOR UPDATE USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'master_admin'::"text"))))));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."contacts" FOR SELECT USING (true);



CREATE POLICY "Public read stats" ON "public"."contact_stats" FOR SELECT USING (true);



CREATE POLICY "Roster is viewable by everyone" ON "public"."club_roster" FOR SELECT USING (true);



CREATE POLICY "Users can create clubs" ON "public"."clubs" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."club_roster" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."auto_register_operator"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_register_operator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_register_operator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lon1" numeric, "lat2" numeric, "lon2" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lon1" numeric, "lat2" numeric, "lon2" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lon1" numeric, "lat2" numeric, "lon2" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_data"("hours_retention" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"("hours_retention" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"("hours_retention" integer) TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_display_logs"("filter_mode" "text", "filter_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_display_logs"("filter_mode" "text", "filter_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_display_logs"("filter_mode" "text", "filter_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_display_logs_clubs"("club_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."location_wkt"("rec" "public"."contacts") TO "anon";
GRANT ALL ON FUNCTION "public"."location_wkt"("rec" "public"."contacts") TO "authenticated";
GRANT ALL ON FUNCTION "public"."location_wkt"("rec" "public"."contacts") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_stats"() TO "service_role";

















































































GRANT ALL ON TABLE "public"."club_roster" TO "anon";
GRANT ALL ON TABLE "public"."club_roster" TO "authenticated";
GRANT ALL ON TABLE "public"."club_roster" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."contact_stats" TO "anon";
GRANT ALL ON TABLE "public"."contact_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contact_stats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contact_stats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contact_stats_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."operator_summary" TO "anon";
GRANT ALL ON TABLE "public"."operator_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_summary" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









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































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


