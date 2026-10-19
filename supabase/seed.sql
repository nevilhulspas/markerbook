SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict RVcoc7RV6FzFYeKLR2oCFgBsBN50ZgjqUaQHRNlbWRN2qP7shM4NcvdNdv1Y3fC

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

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

--
-- Data for Name: ai_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: annotations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: systems; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."systems" ("id", "name", "slug", "display_order", "created_at") VALUES
	('b9b25f32-c213-45b0-9f61-0862049e869b', 'Hematologic', 'hematologic', 1, '2026-03-08 08:50:58.180725+00'),
	('9b99a08f-30f8-4ffb-87b5-cfcb2349d59d', 'Hepatic', 'hepatic', 2, '2026-03-08 08:50:58.180725+00'),
	('b077a4b9-473c-4bfe-9d10-4bf946f05772', 'Renal', 'renal', 3, '2026-03-08 08:50:58.180725+00'),
	('0da213a6-9502-467d-8eee-3bceacbfbb66', 'Cardiovascular', 'cardiovascular', 4, '2026-03-08 08:50:58.180725+00'),
	('e3e8af1d-8600-4535-aaf3-35344fc2224d', 'Endocrine', 'endocrine', 5, '2026-03-08 08:50:58.180725+00'),
	('02a59d07-ee91-4574-90d4-684e8c524cbf', 'Metabolic', 'metabolic', 6, '2026-03-08 08:50:58.180725+00'),
	('9ed2cddb-11ae-4c91-aeca-211d9758a54d', 'Nutritional', 'nutritional', 7, '2026-03-08 08:50:58.180725+00'),
	('65623f3d-001f-4782-9673-1a591777c0fb', 'Immune/Inflammatory', 'immune-inflammatory', 8, '2026-03-08 08:50:58.180725+00');


--
-- Data for Name: panels; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."panels" ("id", "system_id", "name", "short_name", "display_order", "created_at", "loinc_code") VALUES
	('0edf3662-1993-43e4-92f8-ef173712f02f', 'b9b25f32-c213-45b0-9f61-0862049e869b', 'Complete Blood Count', 'CBC', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('c618f3b1-969d-4b19-9ab1-cf89ee45f5f4', 'b9b25f32-c213-45b0-9f61-0862049e869b', 'Iron Studies', 'Iron', 2, '2026-03-08 08:50:58.180725+00', NULL),
	('b3f00338-7c74-46e5-8048-e4cc09cea68e', '9b99a08f-30f8-4ffb-87b5-cfcb2349d59d', 'Liver Function', 'LFT', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('b90e2656-c6ab-433f-a0e1-82fc758053cf', 'b077a4b9-473c-4bfe-9d10-4bf946f05772', 'Kidney Function', 'KFT', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('774b10ad-450f-4714-9201-8ee6c3596911', '0da213a6-9502-467d-8eee-3bceacbfbb66', 'Lipid Panel', 'Lipid', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('6e9e26c2-e69a-46da-927c-1f624d981f6a', '0da213a6-9502-467d-8eee-3bceacbfbb66', 'Cardiac Markers', 'Cardiac', 2, '2026-03-08 08:50:58.180725+00', NULL),
	('22a2b825-dbc1-42b0-8975-59c6037b9eff', 'e3e8af1d-8600-4535-aaf3-35344fc2224d', 'Thyroid Panel', 'Thyroid', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('d86c549a-8b0b-4690-bc76-13ea08e3816a', 'e3e8af1d-8600-4535-aaf3-35344fc2224d', 'Sex Hormones', 'SexH', 2, '2026-03-08 08:50:58.180725+00', NULL),
	('e6b12a2c-d432-413e-94bc-b157654cd895', 'e3e8af1d-8600-4535-aaf3-35344fc2224d', 'Adrenal Hormones', 'Adrenal', 3, '2026-03-08 08:50:58.180725+00', NULL),
	('1cf71205-63eb-4a5a-9349-4058a50a479d', '02a59d07-ee91-4574-90d4-684e8c524cbf', 'Glucose Metabolism', 'GluMet', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('896903f2-9279-490b-a09f-6c853cb481ed', '02a59d07-ee91-4574-90d4-684e8c524cbf', 'Electrolytes', 'Lytes', 2, '2026-03-08 08:50:58.180725+00', NULL),
	('97cf38fa-6997-41a0-82a5-6aa61d496f5e', '9ed2cddb-11ae-4c91-aeca-211d9758a54d', 'Vitamins', 'Vit', 1, '2026-03-08 08:50:58.180725+00', NULL),
	('ea9493e5-5eca-41d0-81aa-8438d73b7cb5', '9ed2cddb-11ae-4c91-aeca-211d9758a54d', 'Minerals', 'Min', 2, '2026-03-08 08:50:58.180725+00', NULL),
	('1765302d-ed6d-4070-9aac-bdba6b8d00a0', '65623f3d-001f-4782-9673-1a591777c0fb', 'Inflammatory Markers', 'Inflam', 1, '2026-03-08 08:50:58.180725+00', NULL);


--
-- Data for Name: biomarkers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."biomarkers" ("id", "name", "short_name", "category", "unit", "description", "ref_range_low", "ref_range_high", "ref_range_low_male", "ref_range_high_male", "ref_range_low_female", "ref_range_high_female", "aliases", "created_at", "parent_id", "variant_name", "panel_id", "archived_at", "loinc_code", "method", "range_source", "is_custom") VALUES
	('c5e3a987-e8cb-46e2-97e7-79d75445aa72', 'Free T3', 'FT3', 'thyroid', 'pg/mL', 'Most active thyroid hormone, converted from T4 in peripheral tissues', 2.0, 4.4, NULL, NULL, NULL, NULL, '{triiodothyronine,"free triiodothyronine",FT3}', '2026-03-08 08:50:58.180725+00', NULL, 'free', '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '3051-0', NULL, NULL, false),
	('e70821a7-3ead-4b47-8c79-27b26f1ccc45', 'Calcium/Osmolality Ratio', NULL, 'CHEM', 'mosm/kg', NULL, 275, 295, NULL, NULL, NULL, NULL, '{"Osmolality (serum)"}', '2026-06-20 14:17:06.213829+00', NULL, NULL, NULL, '2026-06-20 14:33:59.783445+00', '13448-6', NULL, 'ai_estimated', false),
	('aa1ecabb-8354-4f49-8665-e546c76a0c30', 'Bilirubin', 'BIL', 'liver', 'mg/dL', 'Parent group for bilirubin variants (total, direct)', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '1975-2', NULL, NULL, false),
	('79d7d5c7-d7c8-46c4-a8e4-3fbe627f3a9e', 'BUN/Creatinine Ratio', 'BUN/CR', 'kidney', 'ratio', 'Ratio used to differentiate between causes of kidney dysfunction', 10, 20, NULL, NULL, NULL, NULL, '{"BUN-creatinine ratio"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b90e2656-c6ab-433f-a0e1-82fc758053cf', NULL, '3097-3', NULL, NULL, false),
	('e5139bcc-0c79-4940-8b8d-66eb6995c498', 'Helicobacter pylori IgG', NULL, 'Other', 'Index', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-11 13:14:45.511979+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false),
	('69ba9187-b336-48c8-9eac-bdb7a189b322', 'T4', 'T4', 'thyroid', 'ng/dL', 'Parent group for T4 variants (free, total)', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '22a2b825-dbc1-42b0-8975-59c6037b9eff', '2026-06-11 19:44:19.085+00', '3026-2', NULL, NULL, false),
	('7c2dc505-ed96-44a1-936e-68c02fc11387', 'Iodine (Urine)', NULL, 'CHEM', 'µg/L', NULL, 50, 150, NULL, NULL, NULL, NULL, '{"Iodine (urine)"}', '2026-06-20 14:17:07.451153+00', NULL, NULL, NULL, NULL, '2495-0', NULL, 'ai_estimated', false),
	('4b4bc0a4-cc87-48a1-8d7b-636ec7923a8f', 'Insulin-like Growth Factor-I', 'IGF-I', 'CHEM', 'ng/mL', NULL, 53, 500, NULL, NULL, NULL, NULL, '{IGF-1}', '2026-07-09 19:23:43.964569+00', NULL, NULL, NULL, NULL, '2484-4', NULL, 'ai_estimated', false),
	('f3dd0ae9-fe6b-4c82-a32b-92f44f3e6d4d', 'Thyroglobulin', NULL, 'CHEM', 'ng/mL', NULL, 0, 40, NULL, NULL, NULL, NULL, '{}', '2026-07-09 19:23:45.811197+00', NULL, NULL, NULL, NULL, '14918-7', NULL, 'ai_estimated', false),
	('c30dc184-6d2e-4c1c-a325-b209752706e0', 'Vitamin B6', 'B6', 'vitamins', 'ng/mL', 'B vitamin involved in amino acid metabolism and neurotransmitter synthesis', 5.0, 50.0, NULL, NULL, NULL, NULL, '{pyridoxine,"pyridoxal phosphate",PLP}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '2900-9', NULL, NULL, false),
	('42a14841-da5a-4740-a412-08c7e8f7f0eb', 'U, Uranium', NULL, 'Other', 'ratio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:07.914635+00', NULL, NULL, NULL, NULL, '5751-3', NULL, NULL, false),
	('4ebcc5e1-4412-49e7-852d-c0da36e82217', 'Vitamin B12', 'B12', 'vitamins', 'pg/mL', 'Essential vitamin for nerve function and red blood cell formation', 200, 900, NULL, NULL, NULL, NULL, '{cobalamin,cyanocobalamin}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '2132-9', NULL, NULL, false),
	('81f6fe68-a414-4dce-83d7-1302c118ff9f', 'Vitamin D', '25-OH-D', 'vitamins', 'ng/mL', 'Primary circulating form of vitamin D, essential for calcium absorption and bone health', 30, 100, NULL, NULL, NULL, NULL, '{"25-hydroxyvitamin D",calcidiol,"vitamin D3",25(OH)D}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '1989-3', NULL, NULL, false),
	('19caacbd-21f8-419c-8d8e-9e382350f66d', 'Vitamin A', 'VIT-A', 'vitamins', 'ug/dL', 'Fat-soluble vitamin essential for vision, immune function, and skin health', 38, 98, NULL, NULL, NULL, NULL, '{retinol,retinyl}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '2923-1', NULL, NULL, false),
	('a0095d05-82fa-46dc-b6f5-0e15fbed1a22', 'Vitamin E', 'VIT-E', 'vitamins', 'mg/L', 'Fat-soluble antioxidant vitamin that protects cell membranes', 5.5, 17.0, NULL, NULL, NULL, NULL, '{alpha-tocopherol,tocopherol}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '1823-4', NULL, NULL, false),
	('33d595ad-91a6-4f7c-99b2-156a44fe0d21', 'MCH', 'MCH', 'hematology', 'pg', 'Average amount of hemoglobin per red blood cell', 27, 33, NULL, NULL, NULL, NULL, '{"mean corpuscular hemoglobin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '28539-5', NULL, NULL, false),
	('e3224724-d7be-4207-87d9-159f3ee980da', 'Helicobacter pylori IgA', NULL, 'Other', 'Index', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-11 13:14:52.284327+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false),
	('19bdab1d-6478-4e27-9250-d053dc67520e', 'RDW', 'RDW', 'hematology', '%', 'Red Cell Distribution Width - measures variation in red blood cell size', 11.5, 14.5, NULL, NULL, NULL, NULL, '{"Red Cell Distribution Width",RDW-CV}', '2026-03-08 13:40:13.289796+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', '2026-06-11 19:44:19.288+00', '788-0', 'Automated count', NULL, false),
	('6aa0000b-dd66-4612-8bd7-445b19c3a7f0', 'Arsenic, Urine', NULL, 'DRUG/TOX', 'µg/L', NULL, 0, 10, NULL, NULL, NULL, NULL, '{"Arsenic (urine)"}', '2026-06-20 14:17:08.641881+00', NULL, NULL, NULL, NULL, '15115-9', NULL, 'ai_estimated', false),
	('ba7c45f4-8d7d-498b-beec-2515150d0fb0', 'Oxygen Partial Pressure (Capillary)', 'pO2', 'CHEM', 'µg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Copper}', '2026-07-16 09:20:46.020706+00', NULL, NULL, NULL, NULL, '2704-5', NULL, NULL, false),
	('7de5e8e5-6acd-45ea-8aaa-b4acee3f6593', 'Mercury (Hg) in Urine', NULL, 'Other', 'ug/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:05.129749+00', NULL, NULL, NULL, NULL, '5689-5', NULL, NULL, false),
	('6c86c338-736d-4212-ba5a-d61da845e984', 'As, Arsenic', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:06.88056+00', NULL, NULL, NULL, NULL, '25323-7', NULL, NULL, false),
	('8fe15712-1b95-4249-ad6f-3e041067c910', 'Cd, Cadmium', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:07.153418+00', NULL, NULL, NULL, NULL, '25359-1', NULL, NULL, false),
	('fa8da961-80ad-483b-a866-a7110c4ae67e', 'As, Arsenic (u)', NULL, 'Other', 'ratio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:06.638275+00', NULL, NULL, NULL, NULL, '5586-3', NULL, NULL, false),
	('8b2e3954-b08a-422c-87e5-ffbd4eaaa58f', 'Testosterone', 'T', 'hormones', 'ng/dL', 'Parent group for testosterone variants (total, free)', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', '2026-06-11 19:44:18.817+00', '2986-8', NULL, NULL, false),
	('3bc05e6c-da6b-4e86-87e6-6a60c3e05574', 'Pt, Lead', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:10.551361+00', NULL, NULL, NULL, '2026-06-11 19:44:19.564+00', '10912-4', NULL, NULL, false),
	('2ddb70b1-da57-42f5-bb39-660cfba9df9f', 'Arsenic', NULL, 'DRUG/TOX', 'µg/L', NULL, 0, 15, NULL, NULL, NULL, NULL, '{"Arsenic (blood)"}', '2026-06-20 14:17:11.871219+00', NULL, NULL, NULL, NULL, '15114-2', NULL, 'ai_estimated', false),
	('3ccbf7b5-0405-4588-9081-1a6ff3e8526c', 'Oxyhemoglobin Fraction', NULL, 'CHEM', 'mg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Ceruloplasmin}', '2026-07-16 09:20:44.816791+00', NULL, NULL, NULL, NULL, '2716-9', NULL, NULL, false),
	('9dbf2d82-0324-4105-852b-321feb993621', 'Ceruloplasmin', NULL, 'CHEM', 'mg/L', NULL, 20, 40, NULL, NULL, NULL, NULL, '{"Ceruloplasmin (serum)"}', '2026-07-16 09:21:08.633346+00', NULL, NULL, NULL, NULL, '2064-4', NULL, 'ai_estimated', false),
	('d9aa9fc5-a24a-4e36-b97d-dfb6c703569c', 'Cholesterol ratio', NULL, 'Lipid Panel', 'index', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:07:47.437591+00', NULL, NULL, NULL, NULL, '9830-1', NULL, NULL, false),
	('d68ef756-b1ef-4e9b-b8a5-f7f61e99a7c6', 'Neutrophil Stab', NULL, 'Hematology', '%', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:11:38.006232+00', NULL, NULL, NULL, NULL, '26507-4', NULL, NULL, false),
	('78e117bc-228b-41a1-8cdf-1f92a913bbd7', 'Tl, Thallium', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:08.457453+00', NULL, NULL, NULL, NULL, '25537-2', NULL, NULL, false),
	('e299596a-bb1a-4f6a-87a3-ec55a92600bb', 'Co, Cobalt', NULL, 'Liver', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:08.984966+00', NULL, NULL, NULL, NULL, '25378-1', NULL, NULL, false),
	('1b21c217-6d40-4628-83fb-1bfda2ad969a', 'Mo, Molybdenum', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:10.017499+00', NULL, NULL, NULL, NULL, '25481-3', NULL, NULL, false),
	('8da0d637-e7c5-46a0-8de6-b05737b3ae3d', 'hCG', NULL, 'Hormones', 'IU/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:35:21.689138+00', NULL, NULL, NULL, NULL, '19080-1', NULL, NULL, false),
	('a3fc6c35-3e8a-4e8a-a9db-e00031510433', '-ANA (Hep-2)', NULL, 'Other', 'titer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:09.277622+00', NULL, NULL, NULL, NULL, '27200-5', NULL, NULL, false),
	('7d1dc1e0-0c83-44fc-912b-59ce6ed754df', 'Cu, Copper', NULL, 'Vitamins & Minerals', 'mg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:09.25744+00', NULL, NULL, NULL, NULL, '14665-4', NULL, NULL, false),
	('480507b1-0207-4d84-83f2-6ca428562f79', 'ox. LDL(F)', NULL, 'Lipid Panel', 'ng/ml', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:09.040738+00', NULL, NULL, NULL, NULL, '111519-5', NULL, NULL, false),
	('c5238a41-069c-47a5-a0bd-1c20b1caaa5d', 'Transferrin', NULL, 'Iron Studies', 'g/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:21:51.320553+00', NULL, NULL, NULL, NULL, '22674-6', NULL, NULL, false),
	('a628424e-e0b3-4caa-b4d3-ec622db69107', 'Globulin', NULL, 'Liver', 'g/dL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:14:13.734102+00', NULL, NULL, NULL, NULL, '13536-8', NULL, NULL, false),
	('3792d4a3-9df5-4973-964d-742cf410c8a7', 'CK (Creatine Kinase)', NULL, 'Other', 'U/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:08.277336+00', NULL, NULL, NULL, NULL, '2157-6', NULL, NULL, false),
	('4e0eaace-4c16-4c5c-a174-b7fd33249f9b', 'Hg, Mercury', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:10.308162+00', NULL, NULL, NULL, NULL, '32330-3', NULL, NULL, false),
	('2db007bb-0435-46bc-8e93-1b1a78d8bc0c', 'Mn, Manganese', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:08.737521+00', NULL, NULL, NULL, NULL, '25467-2', NULL, NULL, false),
	('64171eb8-d108-47fb-a067-c0de08960c29', 'Anti-Human-Thyreoglobine', NULL, 'Other', 'IU/ml', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:09.560362+00', NULL, NULL, NULL, NULL, '8098-6', NULL, NULL, false),
	('016384aa-b73c-48c9-9a6e-55e865028cc8', 'PSA', NULL, 'Other', 'μg/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:08.523167+00', NULL, NULL, NULL, NULL, '2857-1', NULL, NULL, false),
	('4276e1dc-db0d-4d34-8d6f-203245e69c28', 'PTH', NULL, 'Hormones', 'pmol/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:35:41.57788+00', NULL, NULL, NULL, NULL, '14866-8', NULL, NULL, false),
	('2ba306b3-8e3f-4592-93ca-233b37c9385c', 'UIBC', NULL, 'Other', 'µg/dL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-15 15:59:07.749265+00', NULL, NULL, NULL, NULL, '22753-8', NULL, NULL, false),
	('ba3f5fac-e9dd-4fc8-9801-21eccf0179c8', 'dsDNA', NULL, 'Immune', 'IU/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:33:11.452859+00', NULL, NULL, NULL, NULL, '33800-4', NULL, NULL, false),
	('cbf8009a-5a8c-4fc8-aa13-a63125682aae', 'Barium', NULL, 'Other', 'ug/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-15 15:12:41.464132+00', NULL, NULL, NULL, NULL, '5589-7', NULL, NULL, false),
	('165df636-561f-484c-909b-6e38b296f93b', 'Selenium', NULL, 'Vitamins & Minerals', 'μg/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:30:14.68948+00', NULL, NULL, NULL, NULL, '25521-6', NULL, NULL, false),
	('4c87729c-5875-412d-8e82-dd32c83bbb0c', 'IgE', NULL, 'Immune', 'kU/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:32:21.492746+00', NULL, NULL, NULL, NULL, '19113-0', NULL, NULL, false),
	('358479f2-b3c2-4955-bb2d-45de0a7f8980', 'Total Protein', NULL, 'Liver', 'g/dL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:13:40.271755+00', NULL, NULL, NULL, NULL, '2885-2', NULL, NULL, false),
	('a6ed0283-2767-461c-b25a-9310717552c4', 'Blood pressure (diastolic)', NULL, 'Other', 'mmHg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:37:51.151607+00', NULL, NULL, NULL, NULL, '8462-4', NULL, NULL, false),
	('50694a40-f978-41ae-97de-ac0c392bfe8b', 'Blood pressure (systolic)', NULL, 'Other', 'mmHg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 02:37:37.632051+00', NULL, NULL, NULL, NULL, '8480-6', NULL, NULL, false),
	('7a0022f4-b425-40d0-819d-1d67aec50e75', 'CRP', NULL, 'Inflammation', 'mg/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-27 01:59:26.33583+00', NULL, NULL, NULL, NULL, '1988-5', NULL, NULL, false),
	('6fb70d01-c5f1-442b-bded-a56e942a354b', 'IgA', NULL, 'Other', 'g/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:09.802701+00', NULL, NULL, NULL, NULL, '2458-8', NULL, NULL, false),
	('c714ce8e-c022-4469-a7ea-1c2ba37e57a9', 'IgG', NULL, 'Other', 'g/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:10.07997+00', NULL, NULL, NULL, NULL, '2465-3', NULL, NULL, false),
	('e7aa8c83-8eda-45be-953c-70954c9e7e0e', 'IgM', NULL, 'Other', 'g/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:10.327056+00', NULL, NULL, NULL, NULL, '2472-9', NULL, NULL, false),
	('5c465e40-b488-4f92-9a74-a5de2e07836f', 'Non-HDL-Cholesterol', NULL, 'Lipid Panel', 'mmol/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:08.037073+00', NULL, NULL, NULL, NULL, '43396-1', NULL, NULL, false),
	('8d293b1f-0545-4c92-9a0d-08d4d8e2c339', 'Apolipoprotein B', NULL, 'Lipid Panel', 'g/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:21:08.761184+00', NULL, NULL, NULL, NULL, '1884-6', NULL, NULL, false),
	('04816c82-cb1a-4f5d-9369-25cfab2385ab', 'Homocysteine', '', 'Other', 'µmol/L', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-04-06 09:15:22.994603+00', NULL, '', NULL, NULL, '13965-9', NULL, NULL, false),
	('47fc5149-d00a-4010-9afb-e9f2ab7c3c8a', 'pmol/L for Vitamin B12', NULL, 'Other', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-04-06 09:14:54.647879+00', NULL, NULL, NULL, '2026-06-07 19:16:41.16107+00', NULL, NULL, NULL, false),
	('4050a09d-8aa0-411f-8df9-be15222e8f11', 'Total T3', 'TT3', 'thyroid', 'ng/dL', 'Total triiodothyronine including protein-bound and free forms', 71, 180, NULL, NULL, NULL, NULL, '{"total triiodothyronine",T3}', '2026-03-08 08:50:58.180725+00', NULL, 'total', '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '3053-6', NULL, NULL, false),
	('074f27ee-6d6a-4e1e-9326-91520dd916c4', 'Soluble Transferrin Receptor', 'sTfR', 'CHEM', 'mg/L', NULL, 0.9, 2.8, NULL, NULL, NULL, NULL, '{"Soluble transferrin receptor"}', '2026-06-17 05:58:01.111766+00', NULL, NULL, NULL, NULL, '30248-9', NULL, 'ai_estimated', false),
	('84aefa69-de54-40f5-9e0a-710897718eac', 'Methylmalonate', NULL, 'CHEM', 'nmol/L', NULL, 0, 0.4, NULL, NULL, NULL, NULL, '{"Methylmalonic acid"}', '2026-06-20 15:14:09.145737+00', NULL, NULL, NULL, NULL, '2629-4', NULL, 'ai_estimated', false),
	('6d25cf8a-3dbf-4852-826b-980a39ee156e', 'Calcitriol (Active Vitamin D)', NULL, 'CHEM', 'ng/L', NULL, 15, 60, NULL, NULL, NULL, NULL, '{"1,25-Dihydroxyvitamin D3"}', '2026-06-20 15:14:10.466388+00', NULL, NULL, NULL, NULL, '1649-3', NULL, 'ai_estimated', false),
	('2068071e-ed2d-48a7-9510-51e985c31cec', 'Serum Osmolality', NULL, 'CHEM', 'mosm/kg', NULL, 275, 295, NULL, NULL, NULL, NULL, '{"Osmolality (serum)"}', '2026-06-20 15:14:11.788072+00', NULL, NULL, NULL, NULL, '2692-2', NULL, 'ai_estimated', false),
	('3b6afb94-5ac9-4dec-907c-c9b0918ffc8e', 'Stem Cells / Immature Granulocytes (IG) / Band Cells', NULL, 'Hematology', '%', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-05-04 06:26:19.514383+00', NULL, NULL, NULL, NULL, '38518-7', NULL, NULL, false),
	('216dd455-f0ea-4337-9607-ceaf1bf806dd', 'HbA1c', 'A1c', 'metabolic', '%', 'Average blood sugar over 2-3 months, gold standard for diabetes monitoring', 4.0, 5.6, NULL, NULL, NULL, NULL, '{"glycated hemoglobin","hemoglobin A1c","glycosylated hemoglobin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1cf71205-63eb-4a5a-9349-4058a50a479d', NULL, '4548-4', NULL, NULL, false),
	('7b2ad599-0da9-4185-bd4e-c35422cf538f', 'RDW-SD', NULL, 'Hematology', 'fl', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:33:48.686536+00', NULL, NULL, NULL, NULL, '21000-5', 'Automated count', NULL, false),
	('1975fdff-5d02-408f-820d-5618977f0d16', 'P-LCR', NULL, 'Hematology', '%', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:34:16.992137+00', NULL, NULL, NULL, NULL, '48386-7', 'Automated count', NULL, false),
	('e2f8a4bb-f9d3-4015-99a3-2e92dd7dcf89', 'Basophils', 'BASO', 'hematology', '%', 'Rarest white blood cell type, involved in allergic and inflammatory responses', 0, 1, NULL, NULL, NULL, NULL, '{"basophil percentage",basos,"basophile granulocytes","Basofiele Granulocyten"}', '2026-03-08 08:50:58.180725+00', NULL, 'basophils', '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '706-2', 'Automated count', NULL, false),
	('ee2459d7-bec7-4c27-9487-c8864ebe5e79', 'Eosinophils', 'EOS', 'hematology', '%', 'White blood cells involved in parasitic infections and allergic responses', 1, 4, NULL, NULL, NULL, NULL, '{"eosinophil percentage",eos,"eosinophile granulocytes","Eosinofiele Granulocyten"}', '2026-03-08 08:50:58.180725+00', NULL, 'eosinophils', '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '713-8', 'Automated count', NULL, false),
	('78c24a5d-b909-4e85-86c9-60ae7eca06a9', 'Fibrinogen', 'FIB', 'inflammation', 'mg/dL', 'Clotting protein and inflammatory marker, elevated in acute inflammation', 200, 400, NULL, NULL, NULL, NULL, '{"factor I","plasma fibrinogen"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1765302d-ed6d-4070-9aac-bdba6b8d00a0', NULL, '3255-7', 'Coag', NULL, false),
	('7747eb00-64f2-4326-b2ed-708c4268d14c', 'Lymphocytes', 'LYMPH', 'hematology', '%', 'White blood cells involved in adaptive immunity', 20, 40, NULL, NULL, NULL, NULL, '{"lymphocyte percentage",lymphs,Lymfocyten}', '2026-03-08 08:50:58.180725+00', NULL, 'lymphocytes', '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26478-8', NULL, NULL, false),
	('0ae5b34d-ba7a-4b93-9232-3f08e10bd01a', 'Monocytes', 'MONO', 'hematology', '%', 'White blood cells that become macrophages in tissues', 2, 8, NULL, NULL, NULL, NULL, '{"monocyte percentage",monos,Monocyten}', '2026-03-08 08:50:58.180725+00', NULL, 'monocytes', '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26485-3', NULL, NULL, false),
	('afd349f5-9795-4b8d-970f-681d17239e3c', 'Neutrophils', 'NEUT', 'hematology', '%', 'Most abundant white blood cell type, first responder to bacterial infections', 40, 70, NULL, NULL, NULL, NULL, '{"neutrophil percentage",polys,PMN,"neutrophile granulocytes","Neutrophile Granulocyten"}', '2026-03-08 08:50:58.180725+00', NULL, 'neutrophils', '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26511-6', NULL, NULL, false),
	('2eff0519-c47b-44ed-b605-a698e1f47dbc', 'HOMA-IR', 'HOMA-IR', 'metabolic', 'index', 'Calculated index of insulin resistance using fasting glucose and insulin', 0, 2.5, NULL, NULL, NULL, NULL, '{"homeostatic model assessment","insulin resistance index"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1cf71205-63eb-4a5a-9349-4058a50a479d', NULL, '47214-2', NULL, NULL, false),
	('666352d2-5792-46d9-b952-708d653133a9', 'Bilirubin (Direct)', 'DBIL', 'liver', 'mg/dL', 'Conjugated bilirubin processed by the liver, elevated in bile duct obstruction', 0.0, 0.3, NULL, NULL, NULL, NULL, '{"direct bilirubin","conjugated bilirubin","Bilirubin, direct","bilirubin direct",DBIL}', '2026-03-08 08:50:58.180725+00', 'aa1ecabb-8354-4f49-8665-e546c76a0c30', 'direct', 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '1968-7', NULL, NULL, false),
	('f269ef8f-3b2d-444c-b26a-03b45d082b94', 'Insulin (Fasting)', 'INS', 'metabolic', 'uIU/mL', 'Hormone that regulates blood sugar, elevated levels suggest insulin resistance', 2.6, 24.9, NULL, NULL, NULL, NULL, '{"fasting insulin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1cf71205-63eb-4a5a-9349-4058a50a479d', NULL, '27873-9', NULL, NULL, false),
	('98a709e6-bb1c-4c08-9609-785a25d28f5c', 'LDL Particle Number', 'LDL-P', 'cardiac', 'nmol/L', 'Number of LDL particles, may better predict cardiovascular risk than LDL-C', 0, 1000, NULL, NULL, NULL, NULL, '{LDL-P,"LDL particle count"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '6e9e26c2-e69a-46da-927c-1f624d981f6a', NULL, '54434-6', NULL, NULL, false),
	('9caf0469-359a-40f7-aa44-b08eb586cfd6', 'RDW-CV', NULL, 'Hematology', '%', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:33:56.34264+00', NULL, NULL, NULL, NULL, '788-0', 'Automated count', NULL, false),
	('1e05f4bf-0cd7-4f57-bf01-b35e86d6159a', 'Reverse T3 (RT3)', NULL, 'Thyroid', 'ratio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-03 18:20:41.545126+00', NULL, NULL, NULL, NULL, '3052-8', NULL, NULL, false),
	('ea192bf4-d73d-4be5-a6f7-7085c54dd628', 'eGFR', 'eGFR', 'kidney', 'mL/min/1.73m2', 'Estimated kidney filtration rate, primary measure of kidney function', 90, 999, NULL, NULL, NULL, NULL, '{"estimated glomerular filtration rate",GFR}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b90e2656-c6ab-433f-a0e1-82fc758053cf', NULL, '62238-1', 'Creatinine-based formula (CKD-EPI)/1.73 sq M', NULL, false),
	('96549bb4-79f4-4f0e-971b-dfbbe655b7e2', 'Iodine', 'io', 'Thyroid', 'μg/L', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-05-19 18:30:13.260214+00', NULL, '', NULL, NULL, '2494-3', NULL, NULL, false),
	('4d255772-629c-4bfd-b3ef-351cdad688ad', 'PCT (trombocrit)', NULL, 'Hematology', 'l/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:34:26.337906+00', NULL, NULL, NULL, NULL, '51637-7', NULL, NULL, false),
	('0ec3125b-b369-477d-a9cf-99042870e46f', 'MPV', NULL, 'Hematology', 'fl', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:34:11.761284+00', NULL, NULL, NULL, NULL, '32623-1', 'Automated count', NULL, false),
	('5cff39f5-a75c-411d-bd29-e1b2cffe4714', 'Anti-Tissue Transglutaminase IgA', NULL, 'Other', 'U/mL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:05.878453+00', NULL, NULL, NULL, NULL, '31017-7', NULL, NULL, false),
	('c59c5228-d5d5-4a70-806e-70170982b135', 'Glucose (Fasting)', 'GLU', 'metabolic', 'mg/dL', 'Blood sugar level after fasting, primary diabetes screening marker', 70, 100, NULL, NULL, NULL, NULL, '{"blood sugar","fasting glucose",FBG,"fasting blood glucose"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1cf71205-63eb-4a5a-9349-4058a50a479d', NULL, '1558-6', NULL, NULL, false),
	('da1e8419-a0e5-4ed4-b3a6-a961d97149c6', 'Total T4', 'TT4', 'thyroid', 'ug/dL', 'Total thyroxine including protein-bound and free forms', 4.5, 12.0, NULL, NULL, NULL, NULL, '{"total thyroxine",T4}', '2026-03-08 08:50:58.180725+00', '69ba9187-b336-48c8-9eac-bdb7a189b322', 'total', '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '3026-2', NULL, NULL, false),
	('679fb004-4c87-4dcd-9887-ec0113dab2ba', 'Uric acid', NULL, 'Kidney', 'µmol/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:40:04.64183+00', NULL, NULL, NULL, NULL, '3084-1', NULL, NULL, false),
	('7f26695d-56e3-406d-bfdd-381437f2ebcc', 'Bromide (u)', NULL, 'Vitamins & Minerals', 'mg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-05-31 19:02:19.136446+00', NULL, NULL, NULL, NULL, '1985-1', NULL, NULL, false),
	('a3b42ac6-d9f2-4590-a2e3-1f75e474c242', 'Lymphocytes (absolute)', NULL, 'Hematology', 'G/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:36:48.4844+00', NULL, NULL, NULL, NULL, '26474-7', NULL, NULL, false),
	('6e3f318b-1e37-4741-a81d-36a1e946c24f', 'Monocytes (absolute)', NULL, 'Hematology', 'G/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:36:05.735809+00', NULL, NULL, NULL, NULL, '26484-6', NULL, NULL, false),
	('6df37a39-918f-404d-9c82-7998736c1584', 'Anti-dsDNA IgG', NULL, 'Immune', 'IU/ml', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-03 07:49:39.215016+00', NULL, NULL, NULL, NULL, '33799-8', 'IA', NULL, false),
	('cf96a933-f9f3-443c-9ce8-bd710496b91c', 'Vitamin B2', NULL, 'Vitamins & Minerals', 'nmol/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-03 18:31:26.382417+00', NULL, NULL, NULL, NULL, '2924-9', NULL, NULL, false),
	('86fac295-50fc-470d-92ce-6ab64766a7ba', 'ESR', 'ESR', 'inflammation', 'mm/hr', 'Non-specific marker of inflammation, elevated in many conditions', 0, 20, 0, 15, 0, 20, '{"erythrocyte sedimentation rate","sed rate"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1765302d-ed6d-4070-9aac-bdba6b8d00a0', NULL, '30341-2', NULL, NULL, false),
	('d413497b-96ec-42c4-b5e3-d86a844a8e6b', 'Al, Total (s)', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:06.135661+00', NULL, NULL, NULL, NULL, '5574-9', NULL, NULL, false),
	('16456190-9f7e-4e0c-ad61-ee9befa456f7', 'PDW', NULL, 'Hematology', 'fl', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:34:06.742662+00', NULL, NULL, NULL, NULL, '51631-0', NULL, NULL, false),
	('a9d4c9f0-b7ef-434e-a3e1-3dd745bab025', 'Ni, Total (s)', NULL, 'Other', 'μg/g Cre', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:06.396217+00', NULL, NULL, NULL, NULL, '5702-6', NULL, NULL, false),
	('c1ecae4e-6b1b-4b32-a5f9-c6ebfe8240ef', 'hs-CRP', 'hs-CRP', 'inflammation', 'mg/L', 'Sensitive marker of systemic inflammation and cardiovascular risk', 0, 3.0, NULL, NULL, NULL, NULL, '{CRP,"C-reactive protein","high-sensitivity CRP","cardio CRP"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1765302d-ed6d-4070-9aac-bdba6b8d00a0', NULL, '30522-7', 'High sensitivity', NULL, false),
	('403cee3f-1575-4a75-8c22-90be788d5e5f', 'Zinc', 'ZN', 'minerals', 'ug/dL', 'Essential trace mineral for immune function, wound healing, and DNA synthesis', 60, 120, NULL, NULL, NULL, NULL, '{"serum zinc",Zn}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'ea9493e5-5eca-41d0-81aa-8438d73b7cb5', NULL, '5763-8', NULL, NULL, false),
	('46a628d4-5b60-4cb5-be91-d4b8f63afe82', 'Antimony in urine', NULL, 'Other', 'ratio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:04.881077+00', NULL, NULL, NULL, NULL, '50807-7', NULL, NULL, false),
	('528e0710-2940-4d99-9469-646d9a0872d3', 'Reticulocytes', NULL, 'Hematology', '%', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:39:45.403884+00', NULL, NULL, NULL, NULL, '14196-0', NULL, NULL, false),
	('d766f973-be93-4d3f-b770-4d367b1c6792', 'BNP', 'BNP', 'cardiac', 'pg/mL', 'Peptide released by heart ventricles under stress, marker for heart failure', 0, 100, NULL, NULL, NULL, NULL, '{"brain natriuretic peptide","B-type natriuretic peptide"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '6e9e26c2-e69a-46da-927c-1f624d981f6a', NULL, '30934-4', NULL, NULL, false),
	('dfa1976d-d5fb-4edf-89d8-65ec5a08d24f', 'TIBC', 'TIBC', 'minerals', 'ug/dL', 'Measures blood capacity to bind iron with transferrin, inverse of iron stores', 250, 400, NULL, NULL, NULL, NULL, '{"total iron-binding capacity","total iron binding capacity"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'c618f3b1-969d-4b19-9ab1-cf89ee45f5f4', NULL, '2500-7', NULL, NULL, false),
	('b113d56f-95a6-4da0-a83b-d13b563ac83c', 'MCHC', 'MCHC', 'hematology', 'g/dL', 'Average concentration of hemoglobin in red blood cells', 31.5, 35.7, NULL, NULL, NULL, NULL, '{"mean corpuscular hemoglobin concentration"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '786-4', 'Automated count', NULL, false),
	('c26c416c-0143-4a94-b94e-28ab0735119f', 'Thyroid Peroxidase Antibodies', 'TPO Ab', 'thyroid', 'IU/mL', 'Autoantibodies against thyroid peroxidase, elevated in Hashimoto thyroiditis', 0, 34, NULL, NULL, NULL, NULL, '{TPO,anti-TPO,"thyroid peroxidase ab","thyroid antibodies"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '8099-4', NULL, NULL, false),
	('1ce321f3-f45e-49bf-b01f-4da5c713abbf', 'Total Iron Binding Capacity (TIBC)', NULL, 'Hematology', 'umol/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-03 07:52:03.32729+00', NULL, NULL, NULL, NULL, '14800-7', NULL, NULL, false),
	('2adc7515-6df7-4186-b2a2-4f878d10cd78', 'Anti-DGP IgA', NULL, 'Immune', 'U/mL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-03 07:49:10.881944+00', NULL, NULL, NULL, NULL, '58709-7', NULL, NULL, false),
	('714fe9f4-e291-40e4-89c5-09f5ba87b27e', 'Anti-DGP IgG', NULL, 'Other', 'U/mL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:05.628508+00', NULL, NULL, NULL, NULL, '58710-5', NULL, NULL, false),
	('7db13543-7ed4-4736-9360-4d169f5d426c', 'Basophils (absolute)', NULL, 'Hematology', 'G/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:39:22.06362+00', NULL, NULL, NULL, NULL, '26444-0', NULL, NULL, false),
	('5bd40bc1-48cd-4ef2-8f19-00e95b994c8e', 'Eosinophils (absolute)', NULL, 'Hematology', 'G/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:36:28.607049+00', NULL, NULL, NULL, NULL, '26449-9', NULL, NULL, false),
	('18b9316b-328d-4946-9aa9-0be048855485', 'Neutrophils (absolute)', NULL, 'Hematology', 'G/l', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:39:09.518448+00', NULL, NULL, NULL, NULL, '26499-4', NULL, NULL, false),
	('5d63d9ef-adb2-408d-a10a-78eb6be4ee56', 'eAG (estimated avg glucose)', NULL, 'Diabetes', 'mmol/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:42:28.44618+00', NULL, NULL, NULL, NULL, '27353-2', 'Estimated from glycated hemoglobin', NULL, false),
	('f57e5dfb-866b-4df2-b571-b2d17eca1896', 'LH', 'LH', 'hormones', 'mIU/mL', 'Pituitary hormone that triggers ovulation and stimulates testosterone production', 1.0, 95.6, 1.7, 8.6, 1.0, 95.6, '{"luteinizing hormone"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '10501-5', NULL, NULL, false),
	('78a0ed05-34b3-45b1-88b7-86d0273dfd27', 'Pb, Lead (s)', NULL, 'Other', 'μg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:08.208132+00', NULL, NULL, NULL, NULL, '10912-4', NULL, NULL, false),
	('afd71a80-b008-4ff8-a115-30a0e4c5e45a', 'Mercury (Hg) per g. Crea.', NULL, 'Other', 'ug/gCrea', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 16:20:05.379082+00', NULL, NULL, NULL, NULL, '13465-0', NULL, NULL, false),
	('3e6e659e-deaf-4778-9fee-5037af64c2bc', 'LDH', NULL, 'Lipid Panel', 'U/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:40:47.639302+00', NULL, NULL, NULL, NULL, '14804-9', 'Reaction: lactate to pyruvate', NULL, false),
	('da237a49-9617-43d5-9e7a-eb2397d51930', 'Transferrin Saturation', 'TSAT', 'minerals', '%', 'Percentage of transferrin bound to iron, key iron status indicator', 20, 50, NULL, NULL, NULL, NULL, '{"iron saturation","transferrin sat",TSAT%}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'c618f3b1-969d-4b19-9ab1-cf89ee45f5f4', NULL, '14801-5', NULL, NULL, false),
	('f3933a85-57ad-495d-bd02-f81216189665', 'Vitamin B1', 'B1', 'vitamins', 'nmol/L', 'B vitamin essential for energy metabolism and nerve function', 70, 180, NULL, NULL, NULL, NULL, '{thiamine,thiamin}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '20468-5', NULL, NULL, false),
	('183533e4-a28c-4741-b46c-328aaeb1f1c2', 'Platelets', 'PLT', 'hematology', 'x10^3/uL', 'Blood cells essential for clotting', 150, 400, NULL, NULL, NULL, NULL, '{"platelet count",thrombocytes}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26516-5', NULL, NULL, false),
	('98cb6012-6568-4f8d-86ba-75862d11e766', 'VLDL Cholesterol', 'VLDL', 'lipids', 'mg/dL', 'Very low-density lipoprotein cholesterol, carries triglycerides', 2, 30, NULL, NULL, NULL, NULL, '{VLDL-C,"very low-density lipoprotein"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '2091-7', NULL, NULL, false),
	('1e6e9873-a41d-495c-93f0-9eba4f7eacb6', 'LDL/HDL Ratio', 'LDL/HDL', 'lipids', 'ratio', 'Ratio of LDL to HDL cholesterol, used to assess cardiovascular risk', 0, 3.5, NULL, NULL, NULL, NULL, '{"cholesterol ratio"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '11054-4', NULL, NULL, false),
	('9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', 'Hematocrit', 'HCT', 'hematology', '%', 'Percentage of blood volume composed of red blood cells', 36, 52, 38.3, 48.6, 35.5, 44.9, '{Hct,"packed cell volume",PCV}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '4544-3', 'Automated count', NULL, false),
	('3e2b80bf-c4dc-4bf4-a008-b2dbc5291480', 'MCV', 'MCV', 'hematology', 'fL', 'Average size of red blood cells, used to classify anemia types', 80, 100, NULL, NULL, NULL, NULL, '{"mean corpuscular volume"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '787-2', 'Automated count', NULL, false),
	('21d8f34c-7136-45bc-a14b-5324eb054f0f', 'Troponin I', 'cTnI', 'cardiac', 'ng/mL', 'Protein released during heart muscle damage, primary marker for myocardial infarction', 0, 0.04, NULL, NULL, NULL, NULL, '{troponin,"cardiac troponin",troponin-I,hs-troponin}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '6e9e26c2-e69a-46da-927c-1f624d981f6a', NULL, '10839-9', NULL, NULL, false),
	('5d189691-1c83-4a1a-8fe7-91367981db58', 'ASO (antistreptolysine)', NULL, 'Immune', 'IU/ml', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-06-02 08:41:46.819997+00', NULL, NULL, NULL, NULL, '5370-2', NULL, NULL, false),
	('191fce1e-4049-4719-9b21-5c0048e7512a', 'BUN', 'BUN', 'kidney', 'mg/dL', 'Waste product from protein metabolism, elevated in kidney dysfunction', 6, 20, NULL, NULL, NULL, NULL, '{"blood urea nitrogen",urea,"urea nitrogen"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b90e2656-c6ab-433f-a0e1-82fc758053cf', NULL, '3094-0', NULL, NULL, false),
	('f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'DHEA-S', 'DHEA-S', 'hormones', 'umol/L', 'Adrenal hormone precursor to testosterone and estrogen', 0.95, 15.2, 2.17, 15.2, 0.95, 11.67, '{"dehydroepiandrosterone sulfate",DHEAS,"DHEA sulfate"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'e6b12a2c-d432-413e-94bc-b157654cd895', NULL, '14688-6', NULL, NULL, false),
	('3885e9a3-d5df-4396-9355-33e33a56fe07', 'Interleukin-6', 'IL-6', 'inflammation', 'pg/mL', 'Pro-inflammatory cytokine, elevated in chronic inflammation and autoimmune disease', 0, 7.0, NULL, NULL, NULL, NULL, '{IL-6,"interleukin 6"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1765302d-ed6d-4070-9aac-bdba6b8d00a0', NULL, '26881-3', NULL, NULL, false),
	('d6a11311-df16-4548-a344-6640d688d511', 'Phosphorus', 'PHOS', 'minerals', 'mg/dL', 'Essential mineral for bone structure, energy metabolism, and acid-base balance', 2.5, 4.5, NULL, NULL, NULL, NULL, '{phosphate,"inorganic phosphorus","serum phosphorus"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'ea9493e5-5eca-41d0-81aa-8438d73b7cb5', NULL, '2777-1', NULL, NULL, false),
	('9e979e68-51a5-4153-a14c-a060a78db4d1', 'Prolactin', 'PRL', 'hormones', 'ng/mL', 'Pituitary hormone involved in lactation and reproductive function', 2, 29, 4, 15, 4, 29, '{PRL,"serum prolactin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '2842-3', NULL, NULL, false),
	('b7a58442-fdcc-49db-9931-f37e23a57b1d', 'Bicarbonate', 'HCO3', 'electrolytes', 'mEq/L', 'Buffer that helps maintain blood pH, part of acid-base balance', 23, 29, NULL, NULL, NULL, NULL, '{CO2,"carbon dioxide","total CO2",TCO2}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '896903f2-9279-490b-a09f-6c853cb481ed', NULL, '1963-8', NULL, NULL, false),
	('3a33d3a0-a1b6-48fe-832e-737a98e1eb68', 'Red Blood Cells', 'RBC', 'hematology', 'x10^6/uL', 'Total red blood cell count, carries oxygen throughout the body', 4.0, 5.5, 4.35, 5.65, 3.92, 5.13, '{RBC,erythrocytes,"red cell count"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26453-1', NULL, NULL, false),
	('72b88cba-d849-4ee7-a4f0-8a198cf24408', 'White Blood Cells', 'WBC', 'hematology', 'x10^3/uL', 'Total white blood cell count, reflects immune system activity', 4.5, 11.0, NULL, NULL, NULL, NULL, '{WBC,leukocytes,"white cell count",leucocytes}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '26464-8', NULL, NULL, false),
	('deb52ff3-4531-47f3-b6c7-43c9558893f2', 'HDL Cholesterol', 'HDL', 'lipids', 'mg/dL', 'High-density lipoprotein cholesterol, protective against cardiovascular disease', 40, 100, 40, 100, 50, 100, '{HDL-C,"high-density lipoprotein","good cholesterol"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '2085-9', NULL, NULL, false),
	('accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', 'LDL Cholesterol', 'LDL', 'lipids', 'mg/dL', 'Low-density lipoprotein cholesterol, primary target for cardiovascular risk reduction', 0, 100, NULL, NULL, NULL, NULL, '{LDL-C,"low-density lipoprotein","bad cholesterol"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '2089-1', NULL, NULL, false),
	('b1eba466-8842-4015-8af3-373f326d6794', 'Lipoprotein(a)', 'Lp(a)', 'cardiac', 'nmol/L', 'Genetically determined lipoprotein, independent cardiovascular risk factor', 0, 75, NULL, NULL, NULL, NULL, '{Lp(a),"lipoprotein a",Lp-a}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '6e9e26c2-e69a-46da-927c-1f624d981f6a', NULL, '43583-4', NULL, NULL, false),
	('44275c87-03aa-4b77-b736-cc5d68880ce4', 'FSH', 'FSH', 'hormones', 'mIU/mL', 'Pituitary hormone that stimulates egg and sperm production', 1.0, 134.8, 1.5, 12.4, 1.0, 134.8, '{"follicle-stimulating hormone","follicle stimulating hormone"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '15067-2', NULL, NULL, false),
	('d33003ee-2ccd-489a-bdff-2bad14c5631d', 'Cortisol', 'CORT', 'hormones', 'ug/dL', 'Primary stress hormone from adrenal glands, follows diurnal pattern', 6.2, 19.4, NULL, NULL, NULL, NULL, '{"serum cortisol","morning cortisol",hydrocortisone}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'e6b12a2c-d432-413e-94bc-b157654cd895', NULL, '2143-6', NULL, NULL, false),
	('1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'Estradiol', 'E2', 'hormones', 'pg/mL', 'Primary estrogen hormone, important for reproductive health and bone density', 10, 400, 10, 40, 15, 400, '{E2,"17-beta estradiol",oestradiol}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '2243-4', NULL, NULL, false),
	('814520f7-892c-4b7d-955f-e87cfeefb28b', 'Free T4', 'FT4', 'thyroid', 'ng/dL', 'Active form of thyroxine not bound to proteins, reflects thyroid output', 0.93, 1.7, NULL, NULL, NULL, NULL, '{thyroxine,"free thyroxine",FT4}', '2026-03-08 08:50:58.180725+00', '69ba9187-b336-48c8-9eac-bdb7a189b322', 'free', '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '3024-7', NULL, NULL, false),
	('b116af7b-d1b4-4218-ba0c-c54afd82a620', 'Magnesium', 'MG', 'minerals', 'mg/dL', 'Essential mineral for muscle and nerve function, energy production', 1.7, 2.2, NULL, NULL, NULL, NULL, '{"serum magnesium",Mg}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'ea9493e5-5eca-41d0-81aa-8438d73b7cb5', NULL, '19123-9', NULL, NULL, false),
	('9db5003c-a571-4d2e-871a-0729b3c0f769', 'Progesterone', 'PROG', 'hormones', 'ng/mL', 'Hormone important for menstrual cycle regulation and pregnancy', 0.1, 25.0, 0.1, 0.3, 0.1, 25.0, '{P4,"serum progesterone"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '2839-9', NULL, NULL, false),
	('1d228032-6e7d-48ae-8a9d-f849c702b954', 'Testosterone (Total)', 'T-TOTAL', 'hormones', 'ng/dL', 'Primary androgen hormone, important for muscle mass, bone density, and libido', 15, 1000, 264, 916, 15, 70, '{"total testosterone",testosterone}', '2026-03-08 08:50:58.180725+00', '8b2e3954-b08a-422c-87e5-ffbd4eaaa58f', 'total', 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '2986-8', NULL, NULL, false),
	('3a0ce50d-3630-4256-8cee-8c5fd1fe2036', 'Chloride', 'CL', 'electrolytes', 'mEq/L', 'Electrolyte that works with sodium to maintain fluid balance', 98, 106, NULL, NULL, NULL, NULL, '{Cl,"serum chloride",Cl-}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '896903f2-9279-490b-a09f-6c853cb481ed', NULL, '2075-0', NULL, NULL, false),
	('6bc7cc4c-3ff2-4ed1-bce7-b95fe3364c60', 'Potassium', 'K', 'electrolytes', 'mEq/L', 'Primary intracellular electrolyte, essential for heart rhythm and muscle function', 3.5, 5.0, NULL, NULL, NULL, NULL, '{K,"serum potassium",K+}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '896903f2-9279-490b-a09f-6c853cb481ed', NULL, '2823-3', NULL, NULL, false),
	('4c517970-d387-4deb-ad17-88f048898f30', 'Sodium', 'NA', 'electrolytes', 'mEq/L', 'Primary extracellular electrolyte, essential for fluid balance and nerve function', 136, 145, NULL, NULL, NULL, NULL, '{Na,"serum sodium",Na+}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '896903f2-9279-490b-a09f-6c853cb481ed', NULL, '2951-2', NULL, NULL, false),
	('8946d072-a3f0-4227-bfca-f749c031781b', 'C-Peptide', 'C-PEP', 'metabolic', 'ng/mL', 'Byproduct of insulin production, used to assess pancreatic beta cell function', 0.8, 3.1, NULL, NULL, NULL, NULL, '{"connecting peptide"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '1cf71205-63eb-4a5a-9349-4058a50a479d', NULL, '1986-9', NULL, NULL, false),
	('d9c45588-2735-4a11-8331-1bc26ad710af', 'Calcium', 'CA', 'minerals', 'mg/dL', 'Essential mineral for bone health, muscle contraction, and nerve signaling', 8.6, 10.2, NULL, NULL, NULL, NULL, '{"serum calcium",Ca,"total calcium"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'ea9493e5-5eca-41d0-81aa-8438d73b7cb5', NULL, '17861-6', NULL, NULL, false),
	('6c7e3e16-377b-498c-8137-0c518f5536fb', 'Cystatin C', 'CysC', 'kidney', 'mg/L', 'Alternative kidney function marker less affected by muscle mass than creatinine', 0.53, 0.95, NULL, NULL, NULL, NULL, '{cystatin}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b90e2656-c6ab-433f-a0e1-82fc758053cf', NULL, '33863-2', NULL, NULL, false),
	('e58eb066-b200-44c4-a169-c110050b8993', 'Folate', 'FOL', 'vitamins', 'ng/mL', 'B vitamin essential for DNA synthesis and cell division', 2.7, 17.0, NULL, NULL, NULL, NULL, '{"folic acid","vitamin B9","serum folate"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '97cf38fa-6997-41a0-82a5-6aa61d496f5e', NULL, '2284-8', NULL, NULL, false),
	('08809836-cb1e-41d7-8307-1088b6f14c5e', 'Hemoglobin', 'HGB', 'hematology', 'g/dL', 'Oxygen-carrying protein in red blood cells', 12.0, 17.5, 13.5, 17.5, 12.0, 15.5, '{Hb,Hgb}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '0edf3662-1993-43e4-92f8-ef173712f02f', NULL, '718-7', NULL, NULL, false),
	('18ece77b-9a11-41fe-b5b5-46b3e4637523', 'Iron', 'FE', 'minerals', 'ug/dL', 'Essential mineral for oxygen transport in hemoglobin', 60, 170, 65, 175, 50, 170, '{"serum iron",Fe}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'c618f3b1-969d-4b19-9ab1-cf89ee45f5f4', NULL, '2498-4', NULL, NULL, false),
	('0b68518d-f31d-4586-b13c-3b7f9d90c833', 'SHBG', 'SHBG', 'hormones', 'nmol/L', 'Protein that binds testosterone and estrogen, affecting their bioavailability', 10, 130, 10, 57, 18, 130, '{"sex hormone-binding globulin","sex hormone binding globulin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '13967-5', NULL, NULL, false),
	('d60fdd91-2128-443f-9385-8d6be8b604f9', 'Testosterone (Free)', 'T-FREE', 'hormones', 'pg/mL', 'Unbound active form of testosterone', 0.3, 30, 8.7, 25.1, 0.3, 4.2, '{"free testosterone","free T"}', '2026-03-08 08:50:58.180725+00', '8b2e3954-b08a-422c-87e5-ffbd4eaaa58f', 'free', 'd86c549a-8b0b-4690-bc76-13ea08e3816a', NULL, '2991-8', NULL, NULL, false),
	('7f631e62-f5aa-43e7-978e-6ca98d43ee71', 'Albumin', 'ALB', 'liver', 'g/dL', 'Main protein made by the liver, low levels indicate liver disease or malnutrition', 3.4, 5.4, NULL, NULL, NULL, NULL, '{"serum albumin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '1751-7', NULL, NULL, false),
	('22f611f9-40ef-4c65-9001-cb26eaf2f8ec', 'ALP', 'ALP', 'liver', 'U/L', 'Enzyme found in liver and bone, elevated in bile duct obstruction and bone disorders', 44, 147, NULL, NULL, NULL, NULL, '{"alkaline phosphatase","alk phos"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '6768-6', NULL, NULL, false),
	('3ba846a9-a038-44c4-b70c-f4f7f994d68c', 'ALT', 'ALT', 'liver', 'U/L', 'Liver enzyme, elevated levels indicate liver cell damage', 7, 56, 7, 56, 7, 45, '{SGPT,"alanine aminotransferase","alanine transaminase","GPT (ALT)",GPT,"glutamate pyruvate transaminase"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '1742-6', NULL, NULL, false),
	('bc96eedf-8e6c-4a97-940b-8585412f95b0', 'AST', 'AST', 'liver', 'U/L', 'Enzyme found in liver and heart, elevated with liver or muscle damage', 10, 40, 10, 40, 10, 35, '{SGOT,"aspartate aminotransferase","aspartate transaminase","GOT (AST)",GOT,"glutamate oxaloacetate transaminase"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '1920-8', NULL, NULL, false),
	('573cfaa7-cc86-49fd-958f-4c421840635d', 'Creatinine', 'CREA', 'kidney', 'mg/dL', 'Waste product from muscle metabolism filtered by kidneys', 0.7, 1.3, 0.74, 1.35, 0.59, 1.04, '{"serum creatinine",creat}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b90e2656-c6ab-433f-a0e1-82fc758053cf', NULL, '2160-0', NULL, NULL, false),
	('9a26d642-ce71-4317-8258-6ff925009471', 'Ferritin', 'FER', 'minerals', 'ng/mL', 'Storage form of iron, reflects total body iron stores', 12, 300, 30, 400, 12, 150, '{"serum ferritin"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'c618f3b1-969d-4b19-9ab1-cf89ee45f5f4', NULL, '2276-4', NULL, NULL, false),
	('355ce86b-8434-4e00-8974-8cbdfec20dcb', 'GGT', 'GGT', 'liver', 'U/L', 'Liver enzyme sensitive to alcohol use and bile duct obstruction', 9, 48, 12, 64, 8, 36, '{"gamma-glutamyl transferase",gamma-GT,"gamma-glutamyl transpeptidase"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, 'b3f00338-7c74-46e5-8048-e4cc09cea68e', NULL, '2324-2', NULL, NULL, false),
	('432a7bcc-c736-4bce-960d-19e68d6a15fe', 'Total Cholesterol', 'TC', 'lipids', 'mg/dL', 'Total amount of cholesterol in the blood including LDL, HDL, and VLDL', 125, 200, NULL, NULL, NULL, NULL, '{cholesterol,chol,"total chol"}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '2093-3', NULL, NULL, false),
	('829a92af-7069-44a2-a79a-e01c2f7abb2c', 'Triglycerides', 'TG', 'lipids', 'mg/dL', 'Fat molecules in the blood, elevated levels increase cardiovascular risk', 0, 150, NULL, NULL, NULL, NULL, '{trig,trigs,triglyceride}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '774b10ad-450f-4714-9201-8ee6c3596911', NULL, '2571-8', NULL, NULL, false),
	('1e8ad3b0-69d9-4d44-bf59-ec222dd278db', 'TSH', 'TSH', 'thyroid', 'mIU/L', 'Pituitary hormone that controls thyroid function, primary thyroid screening test', 0.27, 4.2, NULL, NULL, NULL, NULL, '{"thyroid stimulating hormone",thyrotropin}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '22a2b825-dbc1-42b0-8975-59c6037b9eff', NULL, '3016-3', NULL, NULL, false),
	('e8941ddf-d7fb-4401-9bcc-852ebfeda0df', 'Bilirubin (Total)', 'TBIL', 'liver', 'mg/dL', 'Breakdown product of hemoglobin, elevated in liver disease and hemolysis', 0.1, 1.2, NULL, NULL, NULL, NULL, '{"total bilirubin",bilirubin,"Bilirubin, total","bilirubin total",TBIL}', '2026-03-08 08:50:58.180725+00', 'aa1ecabb-8354-4f49-8665-e546c76a0c30', 'total', 'b3f00338-7c74-46e5-8048-e4cc09cea68e', '2026-06-07 19:16:41.16107+00', NULL, NULL, NULL, false),
	('a908e197-5c9e-4aa5-9a76-a8a38a0b9c2f', 'T3', 'T3', 'thyroid', 'pg/mL', 'Parent group for T3 variants (free, total)', NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2026-03-08 08:50:58.180725+00', NULL, NULL, '22a2b825-dbc1-42b0-8975-59c6037b9eff', '2026-06-07 19:16:41.16107+00', NULL, NULL, NULL, false),
	('0a2e2f42-120a-44dd-aab6-e092cad2b9ec', 'Omega-6/Omega-3 Fatty Acid Ratio', NULL, 'CHEM', 'ratio', NULL, 5, 10, NULL, NULL, NULL, NULL, '{"Omega-6/Omega-3 Ratio"}', '2026-06-17 05:58:04.552547+00', NULL, NULL, NULL, NULL, '90910-1', NULL, 'ai_estimated', false);


--
-- Data for Name: biomarker_descriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."biomarker_descriptions" ("id", "biomarker_id", "content", "model", "content_hash", "created_at", "updated_at") VALUES
	('113163bf-ce95-4399-bd14-c163dc1ac2b6', '18ece77b-9a11-41fe-b5b5-46b3e4637523', '# Iron

### What It Measures

Iron is an essential mineral that circulates in your bloodstream, primarily bound to a protein called transferrin. This test measures serum iron—the amount of iron currently floating in your blood plasma at the moment of testing. Iron serves as a critical building block for hemoglobin, the oxygen-carrying molecule inside red blood cells, and myoglobin, which stores oxygen in muscle tissue. Beyond oxygen transport, iron plays vital roles in energy production at the cellular level, DNA synthesis, and proper immune function.

Serum iron levels fluctuate significantly throughout the day and can be influenced by recent meals, making it one of the more variable iron-related biomarkers. This is why it''s typically evaluated alongside other iron studies—like ferritin, total iron-binding capacity (TIBC), and transferrin saturation—to get a complete picture of your iron status.

### Why It Matters

Iron balance exists in a delicate sweet spot: too little causes iron deficiency anemia, leading to fatigue, weakness, pale skin, and impaired cognitive function as your body struggles to deliver adequate oxygen to tissues. This is one of the most common nutritional deficiencies worldwide, particularly affecting menstruating women, pregnant individuals, and those with inadequate dietary intake or absorption issues.

Conversely, excess iron can be harmful. High iron levels may indicate hemochromatosis (a genetic condition causing iron overload), chronic liver disease, or excessive supplementation. Accumulated iron generates harmful free radicals that can damage organs, particularly the liver, heart, and pancreas. Optimal iron levels support robust energy, sharp mental function, strong immunity, and healthy pregnancy outcomes. Because serum iron alone doesn''t tell the whole story, physicians rely on the complete iron panel to distinguish between iron deficiency, chronic disease, or overload conditions.

### Key Factors

- **Dietary intake**: Red meat, poultry, fish, fortified cereals, and legumes directly influence iron levels
- **Time of day**: Iron peaks in the morning and varies by up to 30% throughout the day
- **Recent meals**: Eating before the test can artificially elevate readings
- **Menstrual cycle**: Blood loss during menstruation depletes iron stores
- **Inflammation or infection**: Acute illness can temporarily suppress serum iron
- **Supplementation**: Iron pills or multivitamins dramatically affect measurements
- **Alcohol consumption**: Chronic use can increase iron absorption and levels', 'claude-sonnet-4-5-20250929', 'ece24a82', '2026-03-19 03:01:39.589295+00', '2026-03-19 03:01:39.412+00'),
	('a926ff4a-c27e-45f4-b0c3-d0632d6e63ba', 'a3fc6c35-3e8a-4e8a-a9db-e00031510433', '# ANA (Hep-2)

## What It Measures

Antinuclear antibodies (ANA) are a group of autoantibodies—proteins produced by your immune system that mistakenly target components within the nucleus of your own cells. The Hep-2 test uses human epithelial cells (specifically, a standardized cell line called HEp-2) as a substrate to detect these antibodies in your blood. When present, ANAs bind to various nuclear components like DNA, histones, and other proteins, creating distinctive fluorescent patterns under a microscope that trained laboratory technologists can identify.

The test reports results as a titer, which indicates how many times your blood sample can be diluted and still show a positive reaction. A higher titer means more antibodies are present. The Hep-2 method is considered the gold standard for ANA testing because these cells contain a rich variety of nuclear antigens, making the test highly sensitive for detecting autoimmune activity.

## Why It Matters

ANA testing is primarily used to screen for autoimmune diseases, where the immune system attacks the body''s own tissues. While a positive ANA doesn''t diagnose a specific condition, it can indicate the presence of autoimmune activity and help guide further testing. Conditions associated with positive ANA include systemic lupus erythematosus (SLE), Sjögren''s syndrome, scleroderma, mixed connective tissue disease, and autoimmune hepatitis.

It''s important to understand that ANA positivity is not synonymous with disease. Low-level positive results can occur in healthy individuals, particularly in older adults and women. Studies show that 10-15% of healthy people may have a positive ANA at low titers. The clinical significance depends on the titer level, the specific pattern observed, your symptoms, and other clinical findings. A negative result generally suggests that autoimmune disease is less likely, though it doesn''t completely rule it out.

## Key Factors

- **Age and sex**: Women and older individuals are more likely to have positive results without disease
- **Medications**: Certain drugs (hydralazine, procainamide, some biologics) can induce ANA positivity
- **Infections**: Some viral and bacterial infections can temporarily elevate ANA levels
- **Other autoimmune conditions**: Thyroid disease, rheumatoid arthritis, and other conditions may show positive results
- **Family history**: Genetic predisposition to autoimmune diseases can influence ANA presence', 'claude-sonnet-4-5-20250929', 'fa8da79b', '2026-03-19 06:58:24.135188+00', '2026-03-19 06:58:23.499+00'),
	('5b32a972-4526-47bb-92ed-d59b055856e9', 'd413497b-96ec-42c4-b5e3-d86a844a8e6b', '# Aluminum, Total (Serum)

### What It Measures

Total aluminum in serum measures the concentration of aluminum circulating in your bloodstream at the time of testing. Aluminum is a non-essential element—meaning your body doesn''t need it for any biological function—but it''s the third most abundant element in the Earth''s crust and virtually impossible to avoid completely. We''re exposed to aluminum daily through food (particularly processed foods with aluminum-containing additives), drinking water, cookware, antacids, antiperspirants, and environmental sources. In healthy individuals with normal kidney function, the body efficiently eliminates aluminum through urine, keeping blood levels very low. This test captures a snapshot of your current aluminum burden, reflecting recent exposure and your body''s ability to clear it.

The serum aluminum test is most commonly ordered when there''s concern about excessive exposure or impaired elimination. It''s not typically part of routine health screenings but becomes relevant in specific medical situations where aluminum accumulation could pose health risks.

### Why It Matters

While small amounts of aluminum exposure are generally well-tolerated, elevated levels can become problematic, particularly when kidney function is compromised. Your kidneys are the primary route for aluminum excretion—when they''re not working properly, aluminum can accumulate to toxic levels. This is especially concerning for individuals on dialysis, as traditional dialysis fluids and phosphate binders historically contained aluminum (though this is much less common now with modern treatments).

Chronic aluminum accumulation has been associated with several health issues. In dialysis patients, aluminum toxicity can cause a specific type of bone disease (aluminum-related bone disease), anemia that doesn''t respond to iron supplementation, and in severe cases, dialysis dementia—a neurological condition affecting memory and cognition. For the general population with normal kidney function, concerns focus on occupational exposure (such as welding or aluminum manufacturing) or unusual sources like excessive antacid use containing aluminum hydroxide.

Monitoring aluminum levels helps clinicians detect problematic accumulation before symptoms develop and guides decisions about exposure reduction or chelation therapy in cases of toxicity.

### Key Factors

- **Kidney function**: Impaired renal clearance is the primary risk factor for aluminum accumulation
- **Dietary sources**: Processed foods, aluminum cookware, and drinking water contribute to baseline exposure
- **Medications**: Antacids, buffered aspirin, and some phosphate binders contain significant aluminum
- **Occupational exposure**: Welding, aluminum manufacturing, and mining increase exposure risk
- **Dialysis treatment**: Both dialysis fluids and binding agents can be sources (primarily in older treatment protocols)', 'claude-sonnet-4-5-20250929', '8d64858c', '2026-03-19 06:58:40.282617+00', '2026-03-19 06:58:39.648+00'),
	('3fd3b2da-8c99-4e48-989e-02b2b67f0dae', '7f631e62-f5aa-43e7-978e-6ca98d43ee71', '# Albumin

### What It Measures

Albumin is the most abundant protein in your blood plasma, accounting for roughly 60% of total plasma protein. It''s manufactured exclusively by the liver at a rate of about 10-15 grams per day. This small but mighty protein circulates throughout your bloodstream, where it serves multiple essential functions: maintaining oncotic pressure (the force that keeps fluid inside blood vessels rather than leaking into tissues), transporting hormones, vitamins, drugs, and fatty acids throughout the body, and acting as a buffer to maintain proper blood pH. Measuring albumin levels provides a window into your liver''s synthetic capacity—its ability to produce the proteins your body needs to function.

Because albumin has a relatively long half-life of about 20 days, albumin levels reflect your liver function and nutritional status over weeks rather than days. This makes it a stable marker that won''t fluctuate dramatically with short-term changes, but it also means that abnormalities indicate more chronic or established conditions rather than acute problems.

### Why It Matters

Albumin is a fundamental indicator of both liver health and overall nutritional status. Since only the liver produces albumin, consistently low levels (hypoalbuminemia) can signal chronic liver disease, cirrhosis, or impaired liver synthetic function. However, albumin levels aren''t exclusively about the liver—they can also drop due to malnutrition, protein-losing conditions (like kidney disease or inflammatory bowel disease), severe inflammation, or critical illness.

Optimal albumin levels indicate that your liver is functioning well and you''re maintaining adequate protein nutrition. Low albumin can lead to edema (tissue swelling), ascites (fluid accumulation in the abdomen), and reduced drug transport capacity, which can affect how medications work in your body. Conversely, elevated albumin is uncommon but may indicate dehydration, since albumin concentration increases when blood volume decreases.

### Key Factors

- **Protein intake**: Inadequate dietary protein or malabsorption reduces the building blocks needed for albumin production
- **Liver disease**: Chronic conditions like cirrhosis, hepatitis, or fatty liver disease impair the liver''s ability to synthesize albumin
- **Inflammation**: Acute or chronic inflammatory conditions suppress albumin production as the liver prioritizes making other proteins
- **Hydration status**: Dehydration concentrates albumin levels, while overhydration dilutes them
- **Kidney function**: Nephrotic syndrome and other kidney diseases can cause excessive albumin loss through urine', 'claude-sonnet-4-5-20250929', 'b29ff05f', '2026-03-19 06:58:54.104747+00', '2026-03-19 06:58:53.801+00'),
	('5dde7c99-cba9-4947-b530-92d567f1a078', '22f611f9-40ef-4c65-9001-cb26eaf2f8ec', '# Alkaline Phosphatase (ALP)

### What It Measures

Alkaline phosphatase (ALP) is an enzyme found throughout your body, with particularly high concentrations in the liver, bones, kidneys, and digestive system. In the liver, ALP is produced by cells lining the bile ducts—the small tubes that carry bile (a digestive fluid) from the liver to the intestines. When measured in blood, ALP primarily reflects activity from the liver and bones, though the liver typically accounts for most of the circulating enzyme in adults.

The enzyme''s job is to break down phosphate-containing compounds, which is why it''s called "phosphatase." When liver or bone cells are damaged, or when bile flow is blocked, ALP leaks into the bloodstream in higher amounts. This makes ALP a useful marker for detecting problems with bile flow (cholestasis) or bone turnover.

### Why It Matters

Elevated ALP levels often signal bile duct obstruction or liver disease, particularly conditions affecting the liver''s ability to drain bile properly. This can occur with gallstones, tumors, or inflammation of the bile ducts. Because ALP rises when bile cannot flow normally, it''s especially valuable for distinguishing between different types of liver problems—particularly those involving the bile system versus liver cell damage itself.

ALP can also increase with bone-related conditions, since bone cells produce this enzyme during bone formation and repair. Rapid bone growth (normal in children and adolescents), bone diseases like Paget''s disease, or bone metastases from cancer can all elevate ALP. This dual source sometimes requires additional testing to determine whether elevated levels come from the liver or bones. Conversely, unusually low ALP can indicate malnutrition, certain genetic conditions, or deficiencies in minerals like zinc or magnesium, though this is less common.

### Key Factors

- **Age and growth**: Naturally elevated in children and adolescents due to active bone growth
- **Pregnancy**: Increases during the third trimester as the placenta produces ALP
- **Bone healing**: Fractures or bone conditions increase production
- **Medications**: Certain antibiotics, anti-seizure drugs, and oral contraceptives can raise levels
- **Vitamin D deficiency**: Can affect bone metabolism and ALP levels
- **Recent fatty meal**: May cause temporary elevation', 'claude-sonnet-4-5-20250929', 'a6a10a70', '2026-03-19 06:59:08.746629+00', '2026-03-19 06:59:08.119+00'),
	('da48843e-facc-4b28-b8d4-aaf3dd7fbe77', '3ba846a9-a038-44c4-b70c-f4f7f994d68c', '# ALT (Alanine Aminotransferase)

## What It Measures

ALT is an enzyme found primarily in liver cells (hepatocytes), with smaller amounts in kidneys, heart, and skeletal muscles. When liver cells are damaged or inflamed, they release ALT into the bloodstream, making it one of the most sensitive and specific indicators of liver cell injury. Think of ALT as a marker that leaks out when liver cells are stressed or dying—the more damage occurring, the higher the blood level tends to be.

This enzyme plays a normal role in protein metabolism, helping convert the amino acid alanine into pyruvate for energy production. However, it''s the abnormal release into blood that makes ALT clinically useful. Because the liver contains such high concentrations of this enzyme, even minor liver inflammation can cause measurable increases in blood ALT levels.

## Why It Matters

ALT is considered the most liver-specific of the standard liver enzymes, making it particularly valuable for detecting hepatocellular (liver cell) injury. Elevated levels can indicate various liver conditions, from fatty liver disease and viral hepatitis to medication-induced liver damage and chronic liver disease. In many cases, ALT rises before symptoms appear, allowing for early detection of liver problems.

Optimal ALT levels suggest healthy liver function and efficient detoxification. The liver performs over 500 essential functions, including filtering toxins, producing proteins, storing nutrients, and regulating metabolism. Monitoring ALT helps ensure this vital organ is functioning properly. Persistently elevated levels warrant investigation, as chronic liver inflammation can progress to scarring (fibrosis) and potentially cirrhosis if underlying causes aren''t addressed. Conversely, very low ALT levels are generally not concerning and may reflect good liver health.

## Key Factors

- **Alcohol consumption**: Even moderate drinking can temporarily elevate ALT
- **Medications and supplements**: Statins, acetaminophen, antibiotics, and certain herbal supplements can affect levels
- **Body weight and metabolic health**: Obesity, insulin resistance, and metabolic syndrome commonly raise ALT
- **Viral infections**: Hepatitis A, B, and C directly damage liver cells
- **Physical activity**: Intense exercise can cause temporary increases through muscle breakdown
- **Fatty liver disease**: One of the most common causes of chronic ALT elevation in developed countries', 'claude-sonnet-4-5-20250929', 'c1f5173', '2026-03-19 06:59:21.97457+00', '2026-03-19 06:59:21.664+00'),
	('b27986fa-5204-4fc9-aa5d-8071f13ef745', '64171eb8-d108-47fb-a067-c0de08960c29', '# Anti-Human-Thyroglobulin

### What It Measures

Anti-thyroglobulin antibodies (TgAb) are proteins produced by your immune system that mistakenly target thyroglobulin, a protein made exclusively by your thyroid gland. Thyroglobulin serves as the building block for thyroid hormones—your thyroid stores it in small sacs called follicles and uses it to manufacture the hormones T3 and T4 that regulate metabolism throughout your body. When these antibodies are present, they indicate that your immune system has identified thyroglobulin as a threat, even though it''s a normal, essential protein. This antibody presence suggests an autoimmune process affecting the thyroid gland.

The test measures the concentration of these antibodies circulating in your bloodstream. While some people may have low levels without significant problems, elevated levels typically signal ongoing immune activity against thyroid tissue.

### Why It Matters

Anti-thyroglobulin antibodies are most commonly found in autoimmune thyroid conditions, particularly Hashimoto''s thyroiditis (the leading cause of hypothyroidism in developed countries) and Graves'' disease. Their presence helps clinicians distinguish autoimmune thyroid disease from other thyroid disorders. In Hashimoto''s thyroiditis, these antibodies contribute to gradual thyroid destruction, potentially leading to reduced hormone production over time.

Beyond diagnosis, TgAb levels are particularly important for people with a history of thyroid cancer. Since thyroglobulin itself is used as a tumor marker after thyroid cancer treatment, the presence of anti-thyroglobulin antibodies can interfere with those measurements, making cancer surveillance more complex. Elevated antibodies may also correlate with increased risk of thyroid dysfunction during pregnancy and have been associated with fertility challenges in some individuals, though the mechanisms aren''t fully understood.

### Key Factors

- **Autoimmune conditions**: Having other autoimmune diseases (Type 1 diabetes, celiac disease, rheumatoid arthritis) increases likelihood of thyroid antibodies
- **Genetics**: Family history of thyroid disease or autoimmune conditions significantly raises risk
- **Gender and age**: Women are 5-10 times more likely to develop thyroid antibodies; risk increases with age
- **Iodine intake**: Both deficiency and excess iodine can trigger or worsen autoimmune thyroid responses
- **Pregnancy and postpartum period**: Immune system changes can temporarily increase antibody production', 'claude-sonnet-4-5-20250929', 'ac7b9143', '2026-03-19 06:59:50.61104+00', '2026-03-19 06:59:50.278+00'),
	('726b7d3b-eab1-452a-b80a-40e5a68ffe20', '714fe9f4-e291-40e4-89c5-09f5ba87b27e', '# Anti-DGP IgG

### What It Measures

Anti-DGP IgG (Anti-Deamidated Gliadin Peptide Immunoglobulin G) is an antibody test that detects immune system reactions to deamidated gliadin, a modified form of gliadin protein found in wheat, barley, and rye. When people with certain conditions consume gluten-containing foods, their immune system creates antibodies against these deamidated gliadin peptides. This test specifically measures the IgG class of these antibodies circulating in your bloodstream.

Deamidation is a chemical modification that occurs when gliadin is digested, and in susceptible individuals, the immune system mistakenly identifies these modified proteins as foreign invaders. The presence of Anti-DGP IgG antibodies indicates an active immune response to gluten exposure and is particularly useful for diagnosing and monitoring celiac disease and other gluten-related disorders.

### Why It Matters

Anti-DGP IgG is clinically significant as part of the diagnostic panel for celiac disease, an autoimmune condition where gluten triggers damage to the small intestine. This test has proven especially valuable in young children under age 2, where it can be more sensitive than traditional celiac antibody tests. It also helps identify patients with IgA deficiency who might have false-negative results on IgA-based celiac tests.

Elevated Anti-DGP IgG levels suggest ongoing gluten exposure in someone with gluten sensitivity or celiac disease. The test is useful not only for initial diagnosis but also for monitoring adherence to a gluten-free diet—levels typically decline when gluten is successfully eliminated from the diet. While less specific than some other celiac markers like tissue transglutaminase antibodies, Anti-DGP IgG provides complementary information that can help catch cases that other tests might miss, contributing to a more complete picture of gluten-related immune activity.

### Key Factors

- **Gluten consumption**: Active intake of wheat, barley, or rye directly influences antibody production
- **Dietary adherence**: Following a strict gluten-free diet typically causes antibody levels to decrease over time
- **Age**: Sensitivity and specificity of this test vary by age group, with particular utility in young children
- **Immune status**: IgA deficiency can make this IgG-based test particularly important for accurate assessment
- **Time since exposure**: Recent gluten consumption may temporarily elevate levels, while prolonged avoidance reduces them', 'claude-sonnet-4-5-20250929', 'c173dcdb', '2026-03-19 06:59:36.797479+00', '2026-03-19 06:59:36.511+00'),
	('ab777f49-05c7-4efb-8f16-71b206a57291', '5cff39f5-a75c-411d-bd29-e1b2cffe4714', '# Anti-Tissue Transglutaminase IgA (Anti-tTG IgA)

## What It Measures

Anti-Tissue Transglutaminase IgA is an antibody test that detects immune proteins your body produces when it mistakenly attacks an enzyme called tissue transglutaminase. This enzyme is found throughout the body and plays a crucial role in tissue repair and structural integrity. When someone with celiac disease consumes gluten (a protein found in wheat, barley, and rye), their immune system produces these specific antibodies as part of an autoimmune response.

This test is the primary screening tool for celiac disease, an autoimmune condition where gluten consumption triggers inflammation and damage to the small intestine''s lining. The presence of these antibodies indicates that the immune system is actively responding to gluten exposure and attacking the body''s own tissues.

## Why It Matters

Anti-tTG IgA testing is essential for identifying celiac disease, which affects approximately 1 in 100 people worldwide but often goes undiagnosed for years. When celiac disease remains undetected, ongoing intestinal damage can lead to malabsorption of vital nutrients, resulting in anemia, osteoporosis, neurological problems, and increased risk of certain cancers. Early detection through this biomarker allows individuals to adopt a gluten-free diet, which typically resolves symptoms and prevents long-term complications.

Low or negative levels of this antibody generally indicate the absence of an active autoimmune response to gluten, though it''s important to note that people with IgA deficiency (a separate immune condition) may have falsely negative results. In confirmed celiac disease patients following a strict gluten-free diet, this marker should decrease over time, making it useful for monitoring dietary adherence and intestinal healing.

## Key Factors

- **Gluten consumption**: Recent intake of gluten-containing foods is necessary for accurate testing; avoiding gluten before testing can produce false negatives
- **IgA deficiency**: Approximately 2-3% of people with celiac disease also have selective IgA deficiency, which makes this test unreliable
- **Dietary adherence**: In diagnosed patients, strictly following a gluten-free diet will lower antibody levels over time
- **Autoimmune conditions**: Other autoimmune diseases may occasionally be associated with elevated levels
- **Intestinal damage severity**: Antibody levels often correlate with the degree of intestinal inflammation and damage', 'claude-sonnet-4-5-20250929', '13dcc22f', '2026-03-19 07:00:03.021451+00', '2026-03-19 07:00:02.759+00'),
	('2bc416f6-8af4-407b-b1c7-36d100fd3c2d', '46a628d4-5b60-4cb5-be91-d4b8f63afe82', '# Antimony in Urine

## What It Measures

Antimony is a trace metalloid element that exists naturally in the environment but is primarily encountered through industrial exposure and consumer products. Urinary antimony measurement reflects recent exposure to this element, typically within the past few days. The body absorbs antimony through ingestion, inhalation, or skin contact, and the kidneys efficiently excrete it through urine. This biomarker serves as a biological monitoring tool to assess environmental or occupational antimony exposure, as the body does not require antimony for any physiological function and stores very little of it long-term.

Unlike essential trace minerals, antimony has no known beneficial role in human biology. Measuring antimony in urine provides a snapshot of current body burden and helps identify exposure sources, which can range from contaminated drinking water to workplace environments in industries that use antimony compounds.

## Why It Matters

Monitoring urinary antimony is particularly important for individuals working in certain industries, including battery manufacturing, flame retardant production, semiconductors, ceramics, and mining operations. Even at low levels, chronic antimony exposure has been associated with respiratory irritation, cardiovascular effects, and potential impacts on glucose metabolism. Higher exposure levels can affect the gastrointestinal, cardiovascular, and respiratory systems.

For the general population, antimony exposure typically comes from food (especially foods stored in certain containers), drinking water in areas with natural antimony deposits, and everyday products like textiles treated with flame retardants and certain plastics. Polyethylene terephthalate (PET) plastic bottles can leach small amounts of antimony, particularly when exposed to heat or sunlight. Understanding your antimony levels helps identify potential environmental exposures that may warrant lifestyle adjustments or further investigation.

## Key Factors

- **Occupational exposure**: Working in battery manufacturing, flame retardant production, metal alloys, or mining industries significantly increases antimony exposure
- **Drinking water source**: Groundwater in certain geological areas naturally contains elevated antimony levels
- **Food and beverage containers**: PET plastic bottles and some food packaging can release antimony, especially when heated or stored for extended periods
- **Dietary intake**: Certain foods naturally contain trace amounts of antimony, with higher levels typically found in processed foods and those stored in specific containers
- **Timing of sample collection**: Urinary antimony reflects recent exposure (past 24-48 hours), so levels can fluctuate based on immediate environmental contact', 'claude-sonnet-4-5-20250929', '2435ee01', '2026-03-19 07:00:21.117081+00', '2026-03-19 07:00:20.697+00'),
	('e337a68f-c5a4-480c-bbd2-2c7f9302be74', '8d293b1f-0545-4c92-9a0d-08d4d8e2c339', '# Apolipoprotein B (ApoB)

### What It Measures

Apolipoprotein B is a protein found on the surface of all atherogenic (artery-damaging) lipid particles, including LDL ("bad" cholesterol), VLDL, and lipoprotein(a). Unlike standard cholesterol tests that measure the amount of cholesterol within particles, ApoB counts the actual number of potentially harmful particles circulating in your blood. Each atherogenic particle contains exactly one ApoB molecule, making this measurement a direct particle count. This distinction is important because particle number often matters more than cholesterol content—many small cholesterol-carrying particles can be more dangerous than fewer large ones, even if total cholesterol levels appear similar.

### Why It Matters

ApoB is increasingly recognized as one of the most accurate predictors of cardiovascular disease risk, often outperforming traditional cholesterol measurements. Because it captures all atherogenic particles, it provides a more complete picture of your risk for developing atherosclerosis (plaque buildup in arteries), heart attacks, and strokes. Elevated ApoB indicates a higher number of particles capable of penetrating and damaging arterial walls, regardless of how much cholesterol each particle carries.

This marker is particularly valuable for people with metabolic syndrome, diabetes, or high triglycerides, where standard LDL cholesterol measurements may underestimate true cardiovascular risk. Lower ApoB levels generally indicate better cardiovascular health and reduced arterial disease risk. Many preventive cardiologists now consider ApoB the primary target for lipid management.

### Key Factors

- **Diet composition**: Saturated and trans fats, refined carbohydrates, and excess calories can increase ApoB levels
- **Physical activity**: Regular exercise, especially aerobic activity, typically lowers ApoB particle numbers
- **Body weight and insulin resistance**: Excess body fat, particularly abdominal fat, is strongly associated with elevated ApoB
- **Genetics**: Familial hypercholesterolemia and other inherited lipid disorders significantly affect ApoB levels
- **Medications**: Statins, PCSK9 inhibitors, and other lipid-lowering therapies directly reduce ApoB particle counts', 'claude-sonnet-4-5-20250929', '79302056', '2026-03-19 07:00:35.258599+00', '2026-03-19 07:00:34.887+00'),
	('c1622dca-a006-4de2-94b5-eeab65fe4490', '6c86c338-736d-4212-ba5a-d61da845e984', '# Arsenic (As)

### What It Measures

Arsenic is a toxic heavy metal that can accumulate in the body through environmental exposure, contaminated water, certain foods, and occupational contact. This test measures the concentration of arsenic in your blood, reflecting recent or ongoing exposure to this element. Unlike some minerals your body needs, arsenic serves no biological function and is considered harmful at any level. Blood arsenic levels indicate acute or current exposure, though the metal can also accumulate in tissues like hair, nails, and bones over time. The body attempts to eliminate arsenic primarily through urine, but chronic exposure can overwhelm these detoxification mechanisms.

### Why It Matters

Arsenic exposure is a significant public health concern because even low-level chronic exposure can damage multiple organ systems. Long-term arsenic accumulation has been linked to increased risks of cardiovascular disease, diabetes, various cancers (particularly skin, bladder, and lung), and neurological problems. Acute high-level exposure can cause immediate symptoms like nausea, vomiting, and abdominal pain, while chronic low-level exposure often produces subtle effects that develop gradually over years. Monitoring arsenic levels is particularly important for people living in areas with contaminated groundwater, those who consume large amounts of rice or rice products (which can concentrate arsenic from soil), and individuals working in industries like mining, pesticide manufacturing, or wood treatment. Optimal arsenic levels are as close to zero as possible.

### Key Factors

- **Drinking water source**: Well water in certain geographical regions can contain high natural arsenic levels
- **Diet**: Rice, rice-based products, seafood (particularly seaweed), and some fruit juices may contribute to exposure
- **Occupational exposure**: Mining, smelting, pesticide application, and wood preservation industries
- **Smoking**: Tobacco plants can absorb arsenic from soil and pesticides
- **Geographic location**: Living in areas with arsenic-rich geology or near industrial sites', 'claude-sonnet-4-5-20250929', '96099382', '2026-03-19 07:00:47.015088+00', '2026-03-19 07:00:46.756+00'),
	('be4b6b91-a6c9-4a23-9a65-60b45c1159af', 'bc96eedf-8e6c-4a97-940b-8585412f95b0', '# AST (Aspartate Aminotransferase)

## What It Measures

AST is an enzyme found primarily in the liver, heart, skeletal muscles, kidneys, and red blood cells. When cells in these tissues become damaged or die, AST is released into the bloodstream, making it a marker of cellular injury. In the context of liver function testing, AST helps assess hepatocyte (liver cell) health and integrity. The enzyme plays a role in amino acid metabolism, converting aspartate and alpha-ketoglutarate into oxaloacetate and glutamate—a fundamental process in cellular energy production.

While AST is commonly measured as part of liver function panels, it''s not exclusive to the liver, which is why it''s typically interpreted alongside other biomarkers like ALT (alanine aminotransferase) for more specific diagnostic information.

## Why It Matters

Elevated AST levels signal cellular damage somewhere in the body, most commonly in the liver or heart. In liver disease, AST rises in conditions ranging from fatty liver disease and viral hepatitis to alcohol-related liver injury and cirrhosis. The ratio of AST to ALT provides additional diagnostic clues—a ratio greater than 2:1 often suggests alcohol-related liver damage, while a ratio closer to 1:1 may indicate viral hepatitis or non-alcoholic fatty liver disease.

Beyond the liver, significantly elevated AST can indicate heart muscle damage (such as during a heart attack), muscle disorders, or hemolysis (breakdown of red blood cells). Chronically elevated AST, especially in combination with other abnormal liver markers, may indicate progressive liver disease requiring medical attention. Conversely, normal or low AST levels generally suggest healthy cellular function in these organs, though interpretation always depends on the complete clinical picture.

## Key Factors

- **Alcohol consumption**: Regular or heavy drinking elevates AST, often disproportionately compared to ALT
- **Medications**: Statins, antibiotics, NSAIDs, and certain supplements can cause temporary elevations
- **Physical activity**: Intense exercise or muscle injury can raise AST due to muscle cell breakdown
- **Body weight and metabolism**: Obesity and metabolic syndrome are associated with elevated liver enzymes
- **Viral infections**: Hepatitis A, B, and C directly damage liver cells, releasing AST into circulation', 'claude-sonnet-4-5-20250929', '631406bd', '2026-03-19 07:01:14.039411+00', '2026-03-19 07:01:13.776+00'),
	('117d474a-22a1-41e5-bd62-cf68f24ff938', 'b7a58442-fdcc-49db-9931-f37e23a57b1d', '# Bicarbonate

## What It Measures

Bicarbonate (HCO₃⁻) is an electrolyte that plays a central role in your body''s acid-base balance system. It acts as one of your body''s primary chemical buffers, meaning it helps maintain blood pH within the tightly controlled range necessary for cellular function. When your blood becomes too acidic, bicarbonate neutralizes excess hydrogen ions; when it becomes too alkaline, the system shifts in the opposite direction. Your kidneys and lungs work together to regulate bicarbonate levels—the kidneys can retain or excrete bicarbonate through urine, while the lungs control carbon dioxide (which converts to carbonic acid in the blood), creating a dynamic partnership that keeps your internal environment stable.

This measurement reflects the metabolic component of your acid-base status, as opposed to the respiratory component controlled by breathing. Bicarbonate is continuously produced and consumed in your body through various chemical reactions, and measuring its concentration provides insight into how well your metabolic systems are maintaining equilibrium.

## Why It Matters

Proper bicarbonate levels are essential because even small deviations in blood pH can impair enzyme function, protein structure, and cellular processes throughout your body. Abnormal bicarbonate levels can indicate metabolic acidosis (too little bicarbonate) or metabolic alkalosis (too much bicarbonate), conditions that may stem from kidney disease, uncontrolled diabetes, severe dehydration, prolonged vomiting or diarrhea, or certain medications.

Bicarbonate levels also help healthcare providers distinguish between different types of acid-base disorders and assess how well your body is compensating for imbalances. For instance, in chronic lung disease where carbon dioxide builds up, your kidneys may retain more bicarbonate to compensate. Optimal bicarbonate levels indicate that your kidneys are functioning properly and your metabolic processes are balanced, supporting everything from muscle function to oxygen delivery to your tissues.

## Key Factors

- **Kidney function**: The kidneys are the primary regulators of bicarbonate, so any kidney disease can affect levels
- **Respiratory conditions**: Chronic lung problems trigger compensatory changes in bicarbonate to balance blood pH
- **Severe diarrhea or vomiting**: Significant loss of bodily fluids containing bicarbonate or stomach acid alters levels
- **Medications**: Diuretics, antacids, and certain blood pressure medications can influence bicarbonate concentration
- **Metabolic conditions**: Uncontrolled diabetes, starvation, and severe infections can cause bicarbonate depletion through acid accumulation', 'claude-sonnet-4-5-20250929', '51290a67', '2026-03-19 07:01:42.485591+00', '2026-03-19 07:01:42.095+00'),
	('a816e247-b7c0-45c6-8517-3529e433fe45', 'd766f973-be93-4d3f-b770-4d367b1c6792', '# B-Type Natriuretic Peptide (BNP)

## What It Measures

B-type natriuretic peptide (BNP) is a hormone produced primarily by the ventricles of your heart—the main pumping chambers that send blood throughout your body. When these chambers become stretched or overworked due to increased pressure or volume, they release BNP into your bloodstream as a protective response. This hormone acts as a natural diuretic and vasodilator, helping your body eliminate excess fluid and reduce blood pressure to ease the workload on your heart.

BNP levels directly reflect the degree of stress your heart is experiencing. In healthy hearts under normal conditions, only small amounts circulate in the blood. However, when the heart struggles to pump efficiently—whether from heart failure, valve problems, or other cardiac conditions—BNP production increases proportionally to the severity of the stress.

## Why It Matters

BNP serves as one of the most reliable indicators of heart failure and cardiac dysfunction. Physicians use this biomarker to distinguish between heart-related shortness of breath and breathing problems from other causes like lung disease. Elevated BNP levels suggest your heart isn''t pumping as effectively as it should, which may indicate conditions ranging from mild cardiac strain to significant heart failure requiring intervention.

Beyond diagnosis, BNP monitoring helps track how well heart treatments are working over time. Rising levels may signal worsening heart function or inadequate treatment, while declining levels typically indicate improvement. This makes BNP valuable for managing chronic heart conditions and adjusting medications. Importantly, BNP elevation doesn''t always mean heart failure—kidney disease, pulmonary hypertension, and severe infections can also raise levels—but any significant elevation warrants cardiovascular evaluation.

## Key Factors

- **Heart failure severity**: The primary driver; levels typically correlate with symptom severity and prognosis
- **Kidney function**: Reduced kidney clearance can elevate BNP independent of heart function
- **Age**: Levels naturally increase with aging, even in healthy individuals
- **Body weight**: Obesity is associated with lower BNP levels for unclear reasons
- **Medications**: Certain heart failure drugs (like ACE inhibitors and diuretics) can lower BNP levels as cardiac function improves', 'claude-sonnet-4-5-20250929', '7b528643', '2026-03-19 07:02:10.968134+00', '2026-03-19 07:02:10.683+00'),
	('fd02c697-f8ba-4ac8-80b2-55aa23f4ed80', 'fa8da961-80ad-483b-a866-a7110c4ae67e', '# Arsenic (Urine)

### What It Measures

Urinary arsenic measures the amount of arsenic and its metabolites being eliminated from your body through urine. Arsenic is a naturally occurring element found in rocks, soil, and water, but it can also enter the environment through industrial pollution and agricultural use. When you''re exposed to arsenic through contaminated water, food, or air, your body absorbs it and then works to break it down and excrete it primarily through urine. This test captures both inorganic arsenic (the toxic form) and organic arsenic compounds (generally less harmful forms found in seafood), making it a snapshot of your recent arsenic exposure over the past few days.

The body metabolizes inorganic arsenic through a series of steps in the liver, converting it to different forms that are then filtered out by the kidneys. Measuring these compounds in urine provides a more accurate picture of toxic arsenic burden than blood tests, which only capture very recent exposure.

### Why It Matters

Chronic arsenic exposure, even at low levels, has been linked to serious health consequences including increased risk of skin, lung, and bladder cancers, cardiovascular disease, diabetes, and neurological effects. Arsenic interferes with cellular energy production and can damage DNA, making it a significant public health concern in areas with contaminated water supplies. High levels of arsenic exposure may also cause skin changes, peripheral neuropathy, and gastrointestinal symptoms.

However, it''s important to understand that a single elevated reading doesn''t necessarily indicate dangerous exposure. Some arsenic in urine is normal and expected, particularly if you recently consumed seafood, which contains organic arsenic compounds that are far less toxic than inorganic forms. The clinical concern is primarily with chronic elevation of inorganic arsenic, which requires interpretation by a healthcare provider who can distinguish between dietary sources and potentially harmful environmental exposures.

### Key Factors

- **Seafood consumption**: Eating fish and shellfish within 2-3 days before testing can significantly elevate results due to organic arsenic compounds
- **Drinking water source**: Well water and groundwater in certain geographic regions may contain elevated arsenic levels
- **Rice and rice products**: Rice absorbs arsenic from soil and water more readily than other grains
- **Occupational exposure**: Work in mining, smelting, pesticide production, or wood treatment industries
- **Geographic location**: Living in areas with naturally high arsenic in groundwater or near industrial sites', 'claude-sonnet-4-5-20250929', '4e0eaeaf', '2026-03-19 07:01:02.024899+00', '2026-03-19 07:01:01.753+00'),
	('7484a3ef-5e10-40a5-ade3-39d384184aaf', 'cbf8009a-5a8c-4fc8-aa13-a63125682aae', '# Barium

### What It Measures

Barium is a naturally occurring heavy metal element found in the Earth''s crust that can enter the human body through environmental exposure, diet, and water sources. Blood barium testing measures the concentration of this element in your bloodstream, reflecting recent exposure rather than long-term accumulation. While barium exists in various chemical forms, soluble barium compounds can be absorbed through the digestive tract and, less commonly, through inhalation. The body does not require barium for any biological function, so any detectable amount represents external exposure rather than an essential nutrient.

### Why It Matters

Monitoring barium levels helps identify potential environmental or occupational exposures that could affect health. Low-level barium exposure is common through drinking water and foods like Brazil nuts, seaweed, fish, and certain vegetables grown in barium-rich soil. At normal environmental exposure levels, the body typically eliminates barium efficiently through urine and feces. However, elevated levels may indicate excessive exposure from contaminated water sources, certain industrial settings (welding, electronics manufacturing, mining), or specific medical procedures involving barium contrast agents. While the body can handle small amounts, significantly elevated barium concentrations can affect muscle function, heart rhythm, and blood pressure. Optimal levels should be minimal, as barium serves no beneficial purpose in human physiology. The clinical significance lies primarily in occupational health monitoring and investigating potential environmental contamination.

### Key Factors

- **Water source**: Well water or municipal supplies from areas with natural barium deposits
- **Dietary intake**: Regular consumption of high-barium foods like Brazil nuts, seaweed, and certain fish
- **Occupational exposure**: Work in industries involving barium compounds, ceramics, glass manufacturing, or electronics
- **Geographic location**: Living in areas with naturally high barium levels in soil and groundwater
- **Recent medical imaging**: Barium contrast studies (though these typically use insoluble forms)', 'claude-sonnet-4-5-20250929', '7948fbf4', '2026-03-19 07:01:27.868271+00', '2026-03-19 07:01:27.592+00'),
	('db9ba894-dd70-43f6-9b85-0ee647411a3d', 'aa1ecabb-8354-4f49-8665-e546c76a0c30', '# Bilirubin

### What It Measures

Bilirubin is a yellowish-brown pigment produced during the normal breakdown of red blood cells. When red blood cells reach the end of their roughly 120-day lifespan, they''re dismantled in the spleen and liver, releasing hemoglobin. This hemoglobin is then converted into bilirubin. The liver plays a crucial role in processing this bilirubin—it captures the "unconjugated" (indirect) form from the bloodstream, chemically modifies it into a water-soluble "conjugated" (direct) form, and excretes it through bile into the intestines. Most bilirubin eventually leaves the body through stool, which gives feces its characteristic brown color.

Blood tests typically measure total bilirubin, which includes both the unconjugated form (still being transported to the liver) and the conjugated form (processed by the liver). Some comprehensive panels break these down separately to provide more specific diagnostic information about where problems might exist in this processing pathway.

### Why It Matters

Bilirubin levels serve as a sensitive indicator of liver function and the balance between red blood cell breakdown and the liver''s ability to process waste. When the liver is functioning optimally and red blood cell turnover is normal, bilirubin remains within a narrow healthy range. Elevated levels can signal various conditions: liver diseases that impair bilirubin processing (such as hepatitis or cirrhosis), blockages in the bile ducts that prevent bilirubin excretion, or conditions causing excessive red blood cell destruction (hemolysis).

Significantly elevated bilirubin causes jaundice—a yellowing of the skin and eyes that becomes visible when levels rise substantially. Even mildly elevated levels that don''t cause visible jaundice can indicate underlying liver stress or inefficiency. Conversely, very low bilirubin levels are rarely clinically significant, though emerging research suggests bilirubin may have antioxidant properties at normal concentrations.

### Key Factors

- **Liver health**: Hepatitis, fatty liver disease, cirrhosis, and medication-induced liver injury can impair bilirubin processing
- **Bile duct obstruction**: Gallstones, tumors, or inflammation blocking bile flow prevent normal bilirubin excretion
- **Hemolysis**: Conditions causing rapid red blood cell destruction overwhelm the liver''s processing capacity
- **Fasting state**: Prolonged fasting or very low-calorie diets can temporarily elevate bilirubin levels
- **Gilbert''s syndrome**: A common, benign genetic condition affecting approximately 5% of people that causes mildly elevated bilirubin without health consequences', 'claude-sonnet-4-5-20250929', '26aa6700', '2026-03-19 07:01:58.2401+00', '2026-03-19 07:01:57.952+00'),
	('10e46995-a363-44f3-b61a-cad6fc9544cc', '191fce1e-4049-4719-9b21-5c0048e7512a', '# Blood Urea Nitrogen (BUN)

### What It Measures

Blood Urea Nitrogen (BUN) measures the amount of nitrogen in your blood that comes from urea, a waste product created when your body breaks down protein. When you eat protein—whether from meat, beans, nuts, or other sources—your body uses what it needs for building and repairing tissues, then breaks down the excess. This process produces ammonia, which your liver converts into urea. The urea then travels through your bloodstream to your kidneys, where it''s filtered out and eliminated through urine.

BUN serves as a window into how efficiently your kidneys are filtering waste from your blood. When your kidneys are functioning optimally, they maintain a steady, healthy level of urea in your bloodstream. The measurement specifically captures the nitrogen portion of the urea molecule, which is why it''s called "blood urea nitrogen" rather than simply "blood urea."

### Why It Matters

BUN is one of the most fundamental indicators of kidney health and overall metabolic balance. When kidney function declines, urea accumulates in the blood because it''s not being filtered effectively, causing BUN levels to rise. This can occur in conditions ranging from dehydration and urinary obstruction to chronic kidney disease. Conversely, very low BUN levels might indicate liver problems (since the liver produces urea), malnutrition, or overhydration.

Beyond kidney function, BUN provides insights into your protein metabolism and hydration status. It''s particularly valuable when interpreted alongside creatinine (another kidney marker) to calculate the BUN-to-creatinine ratio, which helps clinicians distinguish between different types of kidney issues and identify whether elevated levels stem from kidney problems or other factors like dehydration or high protein intake.

### Key Factors

- **Hydration status**: Dehydration concentrates urea in the blood, raising BUN; overhydration dilutes it
- **Protein intake**: High-protein diets increase urea production; low-protein diets or malnutrition decrease it
- **Medications**: Corticosteroids, certain antibiotics, and diuretics can affect BUN levels
- **Kidney perfusion**: Heart failure, shock, or blood loss can reduce blood flow to kidneys, elevating BUN
- **Tissue breakdown**: Intense exercise, trauma, burns, or GI bleeding increase protein breakdown and BUN production', 'claude-sonnet-4-5-20250929', 'd1ea689f', '2026-03-19 07:02:23.783638+00', '2026-03-19 07:02:23.515+00'),
	('c8a180d0-28f4-4eff-9ba2-ee1a53b5a645', '79d7d5c7-d7c8-46c4-a8e4-3fbe627f3a9e', '# BUN/Creatinine Ratio

### What It Measures

The BUN/Creatinine Ratio compares two waste products filtered by your kidneys: blood urea nitrogen (BUN) and creatinine. Both are metabolic byproducts that accumulate in your bloodstream and are normally removed through urine. BUN comes primarily from protein breakdown in your diet and body tissues, while creatinine is produced at a relatively constant rate from muscle metabolism. By examining the relationship between these two markers, this ratio helps distinguish between different types of kidney problems and other conditions that might affect kidney function.

This ratio is particularly valuable because BUN and creatinine can be affected by different factors. While both rise when kidney filtration declines, BUN is more sensitive to changes in hydration status, protein intake, and blood flow to the kidneys. Creatinine remains more stable and is primarily influenced by muscle mass and kidney filtration rate. The ratio between them creates a diagnostic pattern that provides insights beyond what either marker tells you individually.

### Why It Matters

The BUN/Creatinine Ratio helps clinicians differentiate between problems originating in the kidneys themselves versus issues affecting kidney function from elsewhere in the body. An elevated ratio often indicates pre-renal conditions—problems occurring before blood reaches the kidney tissue—such as dehydration, heart failure, or gastrointestinal bleeding. A normal or low ratio with elevated individual values typically suggests intrinsic kidney disease, where the kidney tissue itself is damaged.

This distinction is clinically important because it guides different treatment approaches. Dehydration-related elevation might resolve with fluid intake, while intrinsic kidney disease requires more comprehensive management. The ratio can also signal high protein intake, increased protein breakdown from illness or stress, or reduced blood flow to the kidneys. Monitoring trends in this ratio over time helps track kidney health and identify early changes that warrant attention before significant damage occurs.

### Key Factors

- **Hydration status**: Dehydration concentrates BUN more than creatinine, raising the ratio
- **Dietary protein**: High protein intake increases BUN production and can elevate the ratio
- **Muscle mass**: Greater muscle mass produces more creatinine, which can lower the ratio
- **Gastrointestinal bleeding**: Blood protein absorption in the gut raises BUN levels
- **Medications**: Corticosteroids, tetracyclines, and certain diuretics can affect the ratio
- **Catabolic states**: Fever, infection, or tissue breakdown increases BUN more than creatinine', 'claude-sonnet-4-5-20250929', 'af48eee', '2026-03-19 07:02:37.359506+00', '2026-03-19 07:02:37.004+00'),
	('8930a201-8f77-4634-99b2-c595111e3ec2', '8946d072-a3f0-4227-bfca-f749c031781b', '# C-Peptide

### What It Measures

C-peptide (connecting peptide) is a protein fragment that your pancreas produces and releases into your bloodstream in equal amounts to insulin. When your pancreatic beta cells manufacture insulin, they create it as a larger molecule called proinsulin. Before releasing insulin into circulation, the pancreas cleaves off C-peptide, leaving behind the active insulin hormone. Because C-peptide and insulin are released in a 1:1 ratio, measuring C-peptide provides an accurate picture of how much insulin your body is actually producing—unlike measuring insulin directly, which can be confusing because injected insulin, liver metabolism, and certain medications affect insulin levels in the blood.

C-peptide has a longer half-life than insulin (about 30 minutes versus 5 minutes), making it a more stable marker for assessing pancreatic function. It remains in circulation longer and is cleared by the kidneys rather than the liver, providing a clearer window into your pancreas''s insulin-producing capacity over time.

### Why It Matters

C-peptide testing is crucial for distinguishing between different forms of diabetes and assessing pancreatic function. In Type 1 diabetes, the immune system destroys insulin-producing beta cells, leading to very low or absent C-peptide levels—indicating the pancreas has lost its ability to make insulin. In Type 2 diabetes, C-peptide levels are typically normal or elevated initially, reflecting insulin resistance where the pancreas works overtime to produce more insulin. Over time, even Type 2 diabetes can lead to declining C-peptide as the pancreas becomes exhausted.

This biomarker helps clinicians determine whether someone with diabetes still produces their own insulin or depends entirely on external insulin. It''s particularly valuable for diagnosing unusual cases of diabetes, assessing whether insulin therapy is necessary, monitoring pancreas transplant function, and investigating hypoglycemia (low blood sugar) to determine if the pancreas is overproducing insulin. Low C-peptide with high blood sugar suggests insulin deficiency, while high C-peptide with low blood sugar may indicate an insulin-producing tumor or excessive medication.

### Key Factors

- **Fasting status**: C-peptide rises after meals as the pancreas responds to glucose, so timing of the test matters significantly
- **Blood glucose levels**: C-peptide naturally increases when blood sugar is elevated and decreases when it''s low
- **Kidney function**: Impaired kidney function slows C-peptide clearance, potentially elevating levels independent of pancreatic function
- **Medications**: Sulfonylureas and other diabetes medications that stimulate insulin release will increase C-peptide levels
- **Body weight and insulin resistance**: Higher body fat often correlates with elevated C-peptide as the pancreas compensates for insulin resistance', 'claude-sonnet-4-5-20250929', 'eb2878fc', '2026-03-19 07:02:53.173706+00', '2026-03-19 07:02:52.645+00'),
	('df579b65-4742-436b-aecc-4cdc7253fdbc', 'd9c45588-2735-4a11-8331-1bc26ad710af', '# Calcium

### What It Measures

Calcium is the most abundant mineral in the human body, with approximately 99% stored in bones and teeth, while the remaining 1% circulates in the blood. A blood calcium test measures the amount of calcium in your bloodstream, which plays critical roles far beyond skeletal health. This circulating calcium is tightly regulated by hormones including parathyroid hormone (PTH), vitamin D, and calcitonin, which work together to maintain stable blood levels even when dietary intake fluctuates. The test typically measures total calcium, which includes calcium bound to proteins (primarily albumin) and free ionized calcium, which is the metabolically active form that participates in cellular functions.

Blood calcium levels reflect a delicate balance between dietary absorption in the intestines, calcium storage and release from bones, and calcium excretion through the kidneys. Your body prioritizes maintaining consistent blood calcium levels because even small deviations can affect critical physiological processes, sometimes drawing from bone reserves when blood levels drop.

### Why It Matters

Calcium in the bloodstream is essential for muscle contraction (including the heartbeat), nerve signal transmission, blood clotting, and enzyme function throughout the body. Abnormal calcium levels can indicate problems with the parathyroid glands, kidneys, bones, or vitamin D metabolism. Elevated calcium (hypercalcemia) may result from overactive parathyroid glands, certain cancers, excessive vitamin D, prolonged immobilization, or kidney disease, and can cause fatigue, confusion, kidney stones, and cardiac issues. Low calcium (hypocalcemia) may stem from underactive parathyroid glands, vitamin D deficiency, kidney disease, or magnesium deficiency, potentially leading to muscle cramps, tingling sensations, seizures, or abnormal heart rhythms.

Maintaining optimal blood calcium levels is crucial for both immediate cellular function and long-term bone health. Chronic imbalances can compromise bone density, increase fracture risk, and affect cardiovascular and neurological health.

### Key Factors

- **Vitamin D status**: Essential for calcium absorption in the intestines; deficiency impairs calcium uptake
- **Parathyroid function**: PTH regulates calcium release from bones and kidney retention
- **Protein levels**: Low albumin can cause falsely low total calcium readings without affecting ionized calcium
- **Kidney function**: Kidneys regulate calcium excretion and activate vitamin D
- **Medications**: Diuretics, antacids, calcium supplements, and certain cancer drugs can affect levels
- **Dietary intake**: While the body buffers blood levels, extreme dietary deficiency or excess can have effects
- **Magnesium levels**: Magnesium deficiency can impair PTH function and calcium regulation', 'claude-sonnet-4-5-20250929', '5fd81ba0', '2026-03-19 07:03:07.8529+00', '2026-03-19 07:03:07.55+00'),
	('74efa104-9cf0-4da9-8d57-5f3545b8bfa5', '8fe15712-1b95-4249-ad6f-3e041067c910', '# Cadmium (Cd)

## What It Measures

Cadmium is a toxic heavy metal that accumulates in the body over time, primarily from environmental and occupational exposures. This test measures the concentration of cadmium in your blood, reflecting both recent exposure and the body''s overall cadmium burden. Unlike many biomarkers that naturally occur in the body and serve essential functions, cadmium has no biological role and is exclusively harmful. The kidneys are the primary storage site for cadmium, where it can remain for decades with a biological half-life of 10-30 years. Blood cadmium levels provide insight into both recent exposure (within the past few months) and, to some extent, long-term body burden, though urine cadmium testing may better reflect kidney accumulation.

## Why It Matters

Cadmium is a known carcinogen and potent toxin that can damage multiple organ systems even at low concentrations. The kidneys are particularly vulnerable, as chronic cadmium exposure can lead to tubular dysfunction, reduced filtration capacity, and irreversible kidney damage. Cadmium also interferes with bone metabolism by disrupting calcium regulation and vitamin D function, potentially contributing to osteoporosis and increased fracture risk. Additional health concerns include cardiovascular effects, as cadmium exposure has been linked to hypertension and atherosclerosis, and potential impacts on reproductive health and immune function.

The World Health Organization and various health agencies have established guidance levels because there is no safe threshold for cadmium exposure—lower is always better. Monitoring cadmium levels is especially important for people with known exposure risks, as early detection allows for intervention before irreversible organ damage occurs.

## Key Factors

- **Cigarette smoking**: The single largest source of cadmium exposure for most people, as tobacco plants readily absorb cadmium from soil
- **Occupational exposure**: Welding, battery manufacturing, metal plating, and pigment production involve significant cadmium contact
- **Diet**: Shellfish, organ meats, leafy vegetables, and grains grown in contaminated soil can contain elevated cadmium levels
- **Geographic location**: Living near industrial sites, mining operations, or areas with contaminated soil and water increases exposure
- **Zinc and iron status**: Deficiencies in these minerals can increase cadmium absorption from the digestive tract', 'claude-sonnet-4-5-20250929', 'e671a84c', '2026-03-19 07:03:19.780531+00', '2026-03-19 07:03:19.445+00'),
	('e71b6739-0d2f-4551-b8bb-8f58bf7b83c0', '3a0ce50d-3630-4256-8cee-8c5fd1fe2036', '# Chloride

### What It Measures

Chloride is one of the body''s major electrolytes—electrically charged minerals that regulate critical physiological functions. As the primary negatively charged ion (anion) in the blood and extracellular fluid, chloride works in close partnership with sodium, potassium, and bicarbonate to maintain proper fluid balance between cells and blood vessels. Your kidneys carefully regulate chloride levels through filtration and reabsorption processes, adjusting excretion based on your body''s needs.

Beyond simple fluid balance, chloride plays an essential role in maintaining your blood''s acid-base equilibrium (pH). When your body needs to adjust acidity levels, chloride shifts in and out of red blood cells in exchange for bicarbonate, helping keep your blood chemistry stable. Chloride is also a key component of stomach acid (hydrochloric acid), which is crucial for digestion and protecting against pathogens.

### Why It Matters

Chloride levels rarely change in isolation—they typically shift alongside sodium and other electrolytes, providing important clues about your body''s fluid status, kidney function, and acid-base balance. Abnormal chloride levels can indicate dehydration, overhydration, kidney disease, or acid-base disturbances that affect everything from breathing efficiency to cellular metabolism.

Chloride measurements are particularly valuable when interpreted alongside other electrolytes and kidney markers. Significant deviations may signal issues ranging from excessive vomiting or diarrhea (which cause electrolyte losses) to kidney dysfunction, respiratory problems, or metabolic disorders. Because your body tightly regulates electrolytes, persistent abnormalities warrant investigation to identify underlying causes and prevent complications like irregular heart rhythms, muscle weakness, or altered mental status.

### Key Factors

- **Hydration status**: Dehydration concentrates chloride; overhydration dilutes it
- **Dietary salt intake**: Chloride is consumed primarily as sodium chloride (table salt)
- **Kidney function**: Impaired kidneys may retain or waste chloride abnormally
- **Acid-base disorders**: Respiratory or metabolic conditions affecting blood pH alter chloride levels
- **Medications**: Diuretics, corticosteroids, and certain other drugs can significantly impact chloride balance
- **Fluid losses**: Vomiting, diarrhea, or excessive sweating depletes chloride', 'claude-sonnet-4-5-20250929', '74562c01', '2026-03-19 07:03:32.106855+00', '2026-03-19 07:03:31.834+00'),
	('08fc854e-a55b-40e6-8bf3-7b7fd661628d', '3792d4a3-9df5-4973-964d-742cf410c8a7', '# Creatine Kinase (CK)

## What It Measures

Creatine kinase is an enzyme found primarily in your muscles, heart, and brain. It plays a crucial role in energy production by helping convert creatine into phosphocreatine, which serves as a rapid energy reserve for cells during periods of high demand. When muscle tissue is damaged or under stress, CK leaks from cells into the bloodstream, making blood CK levels a sensitive marker of muscle injury or breakdown.

The enzyme exists in three main forms (isoenzymes): CK-MM found predominantly in skeletal muscle, CK-MB concentrated in heart muscle, and CK-BB located mainly in brain tissue. Most CK measured in routine blood tests comes from skeletal muscle, making it a valuable tool for detecting muscle damage from various causes.

## Why It Matters

Elevated CK levels signal that muscle tissue has been damaged or is breaking down more rapidly than normal. This can occur for numerous reasons ranging from benign to serious. Intense exercise, especially if you''re not accustomed to it, commonly causes temporary CK elevation as muscle fibers experience microscopic tears during the normal adaptation process. More concerning causes include muscular dystrophy, inflammatory muscle diseases (myositis), severe trauma, prolonged immobility, or medication side effects—particularly from statin drugs used to lower cholesterol.

Very high CK levels may indicate rhabdomyolysis, a potentially dangerous condition where rapid muscle breakdown releases harmful substances into the blood that can damage the kidneys. Conversely, consistently low CK levels are rarely clinically significant. Monitoring CK is particularly important when starting medications known to affect muscles, during evaluation of muscle weakness or pain, and when assessing recovery from muscle injury.

## Key Factors

- **Exercise intensity**: Resistance training, marathon running, or unaccustomed physical activity can dramatically raise CK for 24-72 hours
- **Medications**: Statins, fibrates, and certain psychiatric medications may increase CK levels
- **Muscle mass**: Individuals with greater muscle mass typically have higher baseline CK levels
- **Intramuscular injections or trauma**: Recent injections, falls, or physical injury to muscles elevate CK
- **Timing**: CK levels peak 12-24 hours after muscle injury and may take several days to normalize', 'claude-sonnet-4-5-20250929', 'efb3cd42', '2026-03-19 07:03:46.236208+00', '2026-03-19 07:03:45.948+00'),
	('46888825-503f-407e-9567-46e1100a5779', 'd33003ee-2ccd-489a-bdff-2bad14c5631d', '# Cortisol

### What It Measures

Cortisol is your body''s primary stress hormone, produced by the adrenal glands that sit atop your kidneys. Often called the "fight or flight" hormone, cortisol plays a crucial role in how your body responds to stress, danger, or challenge. Beyond its stress response function, cortisol acts as a master regulator throughout your body, influencing metabolism, immune function, and energy availability.

This hormone follows a natural daily rhythm called the circadian pattern. Cortisol levels typically peak in the early morning (around 6-8 AM) to help you wake up and feel alert, then gradually decline throughout the day, reaching their lowest point around midnight. This rhythm is essential for maintaining healthy sleep-wake cycles, energy levels, and overall metabolic balance.

### Why It Matters

Cortisol''s widespread influence means that imbalances can affect multiple body systems. When functioning optimally, cortisol helps regulate blood sugar levels, controls inflammation, supports cardiovascular function, and maintains appropriate immune responses. It breaks down proteins and fats for energy during stressful situations and helps your body recover afterward.

Chronically elevated cortisol—often resulting from prolonged stress, certain medications, or adrenal disorders—can contribute to weight gain (particularly around the midsection), high blood pressure, weakened immune function, difficulty sleeping, and impaired blood sugar control. Conversely, insufficient cortisol production can lead to fatigue, low blood pressure, poor stress tolerance, and difficulty maintaining stable energy levels. The timing of cortisol testing matters significantly due to its natural daily fluctuation, which is why understanding when your sample was collected provides important context for interpreting results.

### Key Factors

- **Time of day**: Cortisol varies dramatically throughout the day, with morning levels typically 2-3 times higher than evening levels
- **Stress levels**: Physical illness, psychological stress, intense exercise, and sleep deprivation all elevate cortisol
- **Medications**: Corticosteroid medications, birth control pills, and certain other drugs can significantly impact cortisol levels
- **Sleep quality**: Poor sleep, shift work, or disrupted circadian rhythms can alter normal cortisol patterns
- **Caffeine and fasting**: Both can temporarily raise cortisol levels around the time of testing', 'claude-sonnet-4-5-20250929', 'b6aa0d15', '2026-03-19 07:04:11.81375+00', '2026-03-19 07:04:11.547+00'),
	('8c97eff1-34f8-4346-a1eb-bd30862bdcb1', '7d1dc1e0-0c83-44fc-912b-59ce6ed754df', '# Cu, Copper

## What It Measures

Copper is an essential trace mineral that plays a vital role in numerous enzymatic reactions throughout the body. When you measure serum copper, you''re assessing the amount of this metal circulating in your bloodstream, most of which is bound to a protein called ceruloplasmin. Copper serves as a cofactor for enzymes involved in energy production within cells, the formation of connective tissue, iron metabolism, and the production of neurotransmitters. Your body maintains copper balance through absorption in the small intestine and excretion primarily through bile, making this measurement a reflection of both dietary intake and your body''s ability to regulate copper homeostasis.

The copper in your blood represents only a small fraction of total body copper stores, with most copper residing in the liver, brain, heart, and kidneys. Blood levels can fluctuate based on recent intake, but persistent abnormalities may indicate problems with copper absorption, metabolism, or excretion.

## Why It Matters

Maintaining optimal copper levels is essential for several critical body functions. Copper is required for the production of red blood cells and helps your body absorb and utilize iron properly—without adequate copper, you can develop anemia even with sufficient iron intake. It''s also crucial for maintaining healthy bones, blood vessels, and nerves, and plays an important role in immune function and antioxidant defense through the enzyme superoxide dismutase.

Both copper deficiency and excess can cause serious health problems. Deficiency, though relatively rare, can lead to anemia, bone abnormalities, immune dysfunction, and neurological issues. It may occur with malabsorption disorders, prolonged use of high-dose zinc supplements (which competes with copper), or inadequate dietary intake. Copper excess is also concerning and can occur in genetic conditions like Wilson''s disease, where copper accumulates in the liver and brain, or from environmental exposures. Elevated copper levels are also seen during inflammation, pregnancy, and with estrogen use, as these conditions increase ceruloplasmin production.

## Key Factors

- **Dietary intake**: Shellfish, nuts, seeds, organ meats, whole grains, and dark chocolate are rich copper sources
- **Zinc supplementation**: High doses of zinc can significantly reduce copper absorption and deplete stores over time
- **Inflammatory conditions**: Acute and chronic inflammation elevate ceruloplasmin, artificially raising serum copper levels
- **Hormonal status**: Estrogen (from pregnancy or contraceptives) increases ceruloplasmin and copper levels
- **Genetic conditions**: Wilson''s disease and Menkes disease affect copper metabolism, causing excess or deficiency respectively', 'claude-sonnet-4-5-20250929', '6800b87f', '2026-03-19 07:04:39.889884+00', '2026-03-19 07:04:39.601+00'),
	('e7caa321-d090-4164-86a0-1dfd7e1d084d', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', '# DHEA-S (Dehydroepiandrosterone Sulfate)

### What It Measures

DHEA-S is a steroid hormone produced primarily by the adrenal glands—the small, triangular-shaped glands that sit atop your kidneys. It serves as a precursor hormone, meaning your body converts it into other hormones, particularly testosterone and estrogen. Unlike DHEA (its non-sulfated form), DHEA-S is more stable in the bloodstream and doesn''t fluctuate throughout the day, making it a reliable marker of adrenal function and hormone production capacity.

This biomarker reflects your body''s ability to produce androgens (male-type hormones that both men and women need) and provides insight into adrenal health. DHEA-S levels naturally peak in your mid-20s and gradually decline with age, decreasing by about 80% between ages 25 and 75—a process sometimes called "adrenopause."

### Why It Matters

DHEA-S serves as a window into adrenal gland health and your body''s hormonal reserve. Optimal levels support immune function, bone density, muscle maintenance, cognitive function, and overall vitality. The hormone also plays a role in mood regulation, energy levels, and stress resilience.

Abnormally high levels may indicate adrenal tumors, polycystic ovary syndrome (PCOS) in women, or adrenal hyperplasia—conditions that warrant medical evaluation. Conversely, low levels can signal adrenal insufficiency, chronic stress, or age-related decline. Some research suggests that declining DHEA-S correlates with increased cardiovascular risk, decreased bone density, and reduced sense of well-being, though supplementation remains controversial and should only be considered under medical supervision.

### Key Factors

- **Age**: Levels naturally decline after age 25-30, with significant decreases in later decades
- **Chronic stress**: Prolonged psychological or physical stress may deplete adrenal hormone production
- **Medications**: Corticosteroids, oral contraceptives, and insulin can influence DHEA-S levels
- **Body composition**: Obesity and metabolic syndrome are associated with altered DHEA-S levels
- **Sleep quality**: Poor sleep patterns and circadian rhythm disruption may affect adrenal hormone production', 'claude-sonnet-4-5-20250929', '54db7b74', '2026-03-19 07:05:06.487793+00', '2026-03-19 07:05:05.886+00'),
	('57be16d4-2f38-4f71-8676-7d7e3c98bb6a', 'e299596a-bb1a-4f6a-87a3-ec55a92600bb', '# Cobalt (Co)

## What It Measures

Cobalt is a trace mineral that occurs naturally in the body in very small amounts, primarily as a central component of vitamin B12 (cobalamin). A serum cobalt test measures the concentration of elemental cobalt in your blood, which exists both as part of vitamin B12 and as free ionic cobalt. While the body needs cobalt exclusively for B12 synthesis, we cannot manufacture B12 ourselves—we must obtain it through diet or supplementation. Excess cobalt beyond what''s bound in B12 circulates freely and must be processed primarily by the liver and excreted through the kidneys.

Under normal circumstances, cobalt levels remain quite low and stable. The test is included in liver function assessments because the liver plays a key role in metabolizing and clearing excess cobalt from circulation, making elevated levels a potential indicator of exposure concerns or metabolic dysfunction.

## Why It Matters

Monitoring cobalt is clinically important because elevated levels can signal problematic exposure or accumulation. High cobalt concentrations can occur from occupational exposure (metalworking, mining, battery manufacturing), hip or knee prostheses that contain cobalt-chromium alloys and release metal particles through wear, or excessive supplementation. Chronic cobalt elevation can be toxic, potentially causing cardiomyopathy (heart muscle damage), thyroid dysfunction, nerve damage, and hepatotoxicity.

From a liver perspective, impaired hepatic function may reduce the body''s ability to process and eliminate cobalt efficiently, though this is relatively uncommon. More often, elevated cobalt levels themselves can contribute to liver stress or damage. Normal to low cobalt levels generally indicate appropriate B12 status and no concerning exposure, though the test isn''t used to diagnose B12 deficiency—that requires specific B12 testing.

## Key Factors

- **Metal implants**: Hip or knee replacements with cobalt-chromium components can significantly elevate levels
- **Occupational exposure**: Metalworking, hard metal production, or mining industries increase risk
- **Supplementation**: Excessive cobalt or B12 supplementation beyond physiological needs
- **Diet**: Generally minimal impact, as dietary cobalt is tightly regulated through B12 metabolism
- **Kidney function**: Impaired renal clearance can lead to accumulation of cobalt in the bloodstream', 'claude-sonnet-4-5-20250929', 'b07da0ca', '2026-03-19 07:04:00.250795+00', '2026-03-19 07:03:59.882+00'),
	('98832514-b477-4cd7-ba4e-2b4bdd860472', '573cfaa7-cc86-49fd-958f-4c421840635d', '# Creatinine

### What It Measures

Creatinine is a waste product generated from the normal breakdown of creatine, a compound your muscles use for energy production. Your muscles continuously produce creatinine at a relatively steady rate based on your muscle mass. This waste then travels through your bloodstream to your kidneys, where it''s filtered out and eliminated through urine. Blood creatinine levels reflect the balance between how much your body produces and how efficiently your kidneys remove it, making it one of the most reliable indicators of kidney filtration capacity.

When your kidneys are functioning properly, they maintain creatinine within a consistent range by filtering it at a rate that matches production. The measurement itself is straightforward—higher blood levels typically indicate your kidneys aren''t filtering as efficiently as they should, while very low levels might suggest decreased muscle mass or other metabolic factors.

### Why It Matters

Creatinine serves as a cornerstone biomarker for assessing kidney health because it provides a real-time snapshot of glomerular filtration rate (GFR)—essentially how well your kidney filters are working. When kidney function declines, creatinine begins to accumulate in the blood, often before you experience any symptoms. This makes it invaluable for early detection of chronic kidney disease, monitoring kidney function in people with diabetes or hypertension, and adjusting medication dosages for drugs eliminated through the kidneys.

Beyond kidney disease, creatinine levels help clinicians assess overall metabolic health and can signal dehydration, certain muscle disorders, or complications from medications that affect kidney function. Maintaining optimal kidney function is critical because your kidneys regulate fluid balance, blood pressure, electrolyte levels, and waste removal—fundamental processes that affect every organ system in your body.

### Key Factors

- **Muscle mass**: Athletes and bodybuilders naturally have higher baseline creatinine due to greater muscle mass, while elderly individuals or those with muscle-wasting conditions may have lower levels
- **Hydration status**: Dehydration concentrates creatinine in the blood, while overhydration can dilute it
- **Dietary protein intake**: High-protein diets, especially from cooked meat, can temporarily elevate creatinine levels
- **Medications**: Certain drugs including some antibiotics, blood pressure medications, and NSAIDs can affect kidney function and creatinine levels
- **Physical activity**: Intense exercise, particularly resistance training, can cause temporary increases in creatinine', 'claude-sonnet-4-5-20250929', '580ed23d', '2026-03-19 07:04:24.705069+00', '2026-03-19 07:04:24.091+00'),
	('76b1f87a-57ce-4a52-8e82-7c8ff544aa24', '6c7e3e16-377b-498c-8137-0c518f5536fb', '# Cystatin C

### What It Measures

Cystatin C is a small protein produced at a constant rate by all nucleated cells throughout the body. It''s freely filtered through the kidney''s glomeruli (the filtering units) and then completely broken down and reabsorbed by the tubular cells, meaning it doesn''t return to the bloodstream under normal conditions. This makes cystatin C an excellent marker of glomerular filtration rate (GFR)—essentially, how well your kidneys are filtering waste from your blood. Unlike creatinine, the more traditional kidney marker, cystatin C levels are not significantly influenced by muscle mass, age, sex, or race, making it a more universal measure of kidney function across different populations.

### Why It Matters

Cystatin C provides early detection of declining kidney function, often catching problems before creatinine levels become abnormal. When your kidneys begin to lose filtering capacity—whether from chronic kidney disease, acute kidney injury, diabetes-related damage, or hypertension—cystatin C accumulates in the blood because it''s not being efficiently filtered out. This makes it particularly valuable for detecting mild to moderate kidney impairment that might otherwise go unnoticed. Optimal cystatin C levels indicate your kidneys are efficiently clearing waste products, maintaining proper fluid balance, and regulating electrolytes and blood pressure. Elevated levels warrant further evaluation and monitoring, as kidney disease often progresses silently without symptoms until significant damage has occurred. Early detection allows for interventions that can slow or prevent progression to more serious kidney disease or failure.

### Key Factors

- **Thyroid function**: Hyperthyroidism can increase cystatin C production, while hypothyroidism may decrease it
- **Corticosteroid medications**: High-dose steroids can elevate cystatin C levels independent of kidney function
- **Inflammatory conditions**: Severe inflammation or active autoimmune disease may transiently affect levels
- **Obesity**: Higher body mass may be associated with slightly elevated cystatin C
- **Smoking**: Chronic tobacco use can influence cystatin C levels, though the mechanism isn''t fully understood', 'claude-sonnet-4-5-20250929', '53cc7f10', '2026-03-19 07:04:53.677695+00', '2026-03-19 07:04:53.315+00'),
	('37e831e5-a6ef-47aa-8121-321c39e783ac', 'ea192bf4-d73d-4be5-a6f7-7085c54dd628', '# eGFR (Estimated Glomerular Filtration Rate)

### What It Measures

eGFR estimates how efficiently your kidneys filter waste products from your blood. Specifically, it calculates the volume of fluid that passes through the tiny filtering units in your kidneys (glomeruli) per minute, standardized to body surface area. This measurement is derived from a formula that considers your creatinine level along with factors like age, sex, and race, rather than being directly measured.

Your kidneys contain approximately one million nephrons, each with a glomerulus that acts like a microscopic sieve. As blood flows through these filters, waste products and excess fluid pass into the urine while essential proteins and blood cells remain in the bloodstream. The eGFR provides a snapshot of this filtration capacity, offering the most practical way to assess overall kidney function in routine clinical practice.

### Why It Matters

eGFR is the primary indicator used to diagnose and stage chronic kidney disease (CKD). Values above 90 mL/min/1.73m² typically indicate normal or high kidney function, while progressively lower values signal declining kidney capacity. When kidney function drops significantly, waste products like urea and creatinine accumulate in the blood, potentially leading to fatigue, swelling, electrolyte imbalances, and other serious complications.

Monitoring eGFR over time helps identify kidney disease in its earliest stages, often before you experience any symptoms. Early detection is crucial because interventions like blood pressure control, dietary modifications, and medication adjustments can slow or even halt kidney damage progression. Declining eGFR also affects medication dosing—many drugs are cleared by the kidneys and require adjustment when filtration decreases. Severe kidney impairment (eGFR below 15) may eventually require dialysis or transplantation.

### Key Factors

- **Muscle mass**: More muscle produces more creatinine, which can affect the calculation—bodybuilders may have falsely lower eGFR estimates
- **Dehydration**: Inadequate fluid intake can temporarily reduce kidney filtration efficiency
- **Protein intake**: Very high or very low protein diets can influence creatinine production
- **Certain medications**: NSAIDs, ACE inhibitors, and other drugs can impact kidney filtration rates
- **Age**: Kidney function naturally declines with aging, typically starting after age 40', 'claude-sonnet-4-5-20250929', 'a0fe89f6', '2026-03-19 07:05:19.547614+00', '2026-03-19 07:05:19.28+00'),
	('bb8ed320-7670-49da-89fc-523fa6c956c8', '86fac295-50fc-470d-92ce-6ab64766a7ba', '# Erythrocyte Sedimentation Rate (ESR)

### What It Measures

Erythrocyte Sedimentation Rate (ESR) measures how quickly red blood cells settle to the bottom of a test tube over one hour. In healthy conditions, red blood cells fall slowly because they naturally repel each other. However, during inflammation, the body produces proteins—particularly fibrinogen and immunoglobulins—that cause red blood cells to clump together. These heavier clumps fall faster, resulting in a higher ESR value.

This test doesn''t identify a specific disease but rather serves as a general indicator that inflammation exists somewhere in the body. The rate is measured in millimeters per hour, representing the distance red blood cells have descended in a standardized tube during the testing period.

### Why It Matters

ESR acts as a general "inflammation thermometer" for your body. Elevated levels indicate that your immune system is actively responding to something—whether an infection, autoimmune condition, tissue damage, or chronic inflammatory state. Clinicians often use ESR alongside other tests to monitor disease activity in conditions like rheumatoid arthritis, temporal arteritis, and polymyalgia rheumatica, or to track how well treatment is working.

While ESR is sensitive to inflammation, it''s not specific—many different conditions can raise it. It rises and falls relatively slowly compared to other inflammatory markers, making it useful for tracking long-term trends rather than acute changes. Very low ESR values are generally normal, though extremely low readings occasionally occur with certain blood disorders. Moderately elevated levels warrant investigation, while very high values often indicate significant inflammatory or infectious processes requiring medical attention.

### Key Factors

- **Age and sex**: ESR naturally increases with age; women typically have slightly higher baseline values than men
- **Anemia**: Low red blood cell counts can falsely elevate ESR readings
- **Pregnancy**: ESR increases during pregnancy due to normal physiological changes
- **Medications**: Certain drugs, including corticosteroids and NSAIDs, can lower ESR by reducing inflammation
- **Chronic inflammatory conditions**: Autoimmune diseases, infections, and cancers can cause persistent elevation
- **Sample handling**: ESR must be measured within a specific timeframe; delayed testing can affect accuracy', 'claude-sonnet-4-5-20250929', '872db977', '2026-03-19 07:05:34.763896+00', '2026-03-19 07:05:34.502+00'),
	('a45e5b13-0628-462d-939e-37afc9f2dc04', '9a26d642-ce71-4317-8258-6ff925009471', '# Ferritin

### What It Measures

Ferritin is a protein that stores iron inside your cells, primarily in the liver, spleen, and bone marrow. When your body needs iron to make hemoglobin (the oxygen-carrying component of red blood cells) or for other essential functions, ferritin releases it in a controlled manner. Blood ferritin levels reflect your body''s total iron stores—think of it as a gauge showing how full your iron tank is. Unlike tests that measure iron circulating in your blood at a specific moment, ferritin provides insight into your long-term iron reserves.

This biomarker is particularly valuable because it responds to both iron deficiency and iron overload. When iron stores are depleted, ferritin drops significantly before other signs of anemia appear, making it an early warning system. Conversely, when excess iron accumulates in the body, ferritin levels rise accordingly.

### Why It Matters

Ferritin is essential for diagnosing and monitoring iron-related disorders. Low ferritin indicates depleted iron stores, which can lead to iron deficiency anemia—causing fatigue, weakness, pale skin, and impaired cognitive function. Iron deficiency is one of the most common nutritional deficiencies worldwide and can significantly impact energy levels, athletic performance, immune function, and pregnancy outcomes.

Elevated ferritin levels can signal iron overload conditions like hemochromatosis (where the body absorbs too much iron from food), or may indicate chronic inflammation, liver disease, or certain cancers. Ferritin is also an acute phase reactant, meaning it rises during infection, inflammation, or tissue damage, which can sometimes mask true iron deficiency in people with inflammatory conditions.

Maintaining optimal ferritin levels supports energy production, cognitive function, immune health, and oxygen delivery throughout the body.

### Key Factors

- **Dietary iron intake**: Red meat, fortified cereals, leafy greens, and vitamin C (which enhances absorption) significantly influence iron stores
- **Menstruation**: Monthly blood loss in women commonly depletes iron reserves
- **Inflammation and infection**: Active illness, chronic inflammatory conditions, or autoimmune diseases artificially elevate ferritin
- **Blood donation or loss**: Regular donation, surgery, or gastrointestinal bleeding depletes stores
- **Pregnancy and breastfeeding**: Increased iron demands can rapidly drain reserves', 'claude-sonnet-4-5-20250929', '48377585', '2026-03-19 07:06:00.252786+00', '2026-03-19 07:05:59.857+00'),
	('14a9c3a5-91ea-4b9c-9b01-50921b1edae4', 'e58eb066-b200-44c4-a169-c110050b8993', '# Folate

### What It Measures

Folate, also known as vitamin B9, is a water-soluble vitamin essential for numerous cellular processes throughout the body. This biomarker measures the amount of folate circulating in your blood serum at the time of testing. Folate exists in several forms, both naturally occurring in foods (folate) and synthetic (folic acid, found in supplements and fortified foods). The body cannot produce folate on its own, making dietary intake the sole source of this critical nutrient.

At the cellular level, folate serves as a cofactor for enzymes involved in DNA synthesis, DNA repair, and methylation reactions. It plays an indispensable role in cell division and growth, which is why it''s particularly important during periods of rapid development like pregnancy, infancy, and adolescence. Folate also works closely with vitamin B12 and vitamin B6 in metabolizing homocysteine, an amino acid that, when elevated, is associated with cardiovascular concerns.

### Why It Matters

Adequate folate levels are crucial for preventing neural tube defects during fetal development, which is why folate supplementation is universally recommended before and during pregnancy. Beyond pregnancy, folate supports the production of healthy red blood cells—deficiency can lead to megaloblastic anemia, characterized by fatigue, weakness, and unusually large, immature red blood cells that function poorly.

Folate status also influences cognitive function, mood regulation, and cardiovascular health through its role in homocysteine metabolism. Low folate levels have been associated with depression, cognitive decline, and increased cardiovascular risk. Conversely, maintaining optimal folate levels supports healthy neurological function, proper cell division throughout the body, and efficient energy metabolism. Since folate is water-soluble and not stored long-term in significant amounts, consistent dietary intake is necessary to maintain healthy levels.

### Key Factors

- **Dietary intake**: Leafy greens, legumes, citrus fruits, and fortified grains are primary sources
- **Alcohol consumption**: Interferes with folate absorption and metabolism
- **Medications**: Methotrexate, anticonvulsants, and some antibiotics can deplete folate
- **Digestive health**: Celiac disease, Crohn''s disease, and other malabsorption conditions reduce absorption
- **Pregnancy and lactation**: Significantly increase folate requirements
- **Genetic variations**: MTHFR gene polymorphisms affect folate metabolism efficiency', 'claude-sonnet-4-5-20250929', '69e06270', '2026-03-19 07:06:22.986079+00', '2026-03-19 07:06:22.713+00'),
	('b2ed4144-c772-47b4-8652-8df11081e55e', '355ce86b-8434-4e00-8974-8cbdfec20dcb', '# Gamma-Glutamyl Transferase (GGT)

### What It Measures

Gamma-glutamyl transferase (GGT) is an enzyme found primarily in liver cells, though it''s also present in smaller amounts in the kidneys, pancreas, and bile ducts. This enzyme plays a crucial role in the metabolism of glutathione, one of the body''s most important antioxidants, and helps transport amino acids across cell membranes. When liver or bile duct cells are damaged or under stress, GGT leaks into the bloodstream, making it detectable in blood tests.

GGT is particularly sensitive to bile duct obstruction and conditions affecting the biliary system. Unlike some other liver enzymes, GGT levels rise specifically when there''s cholestasis (reduced bile flow) or when liver cells are exposed to certain toxins or medications. This makes it especially useful for distinguishing whether elevated liver enzymes are truly liver-related or originating from other tissues like bone or muscle.

### Why It Matters

GGT serves as an early warning system for liver stress and biliary tract problems. Elevated levels often appear before other liver function tests become abnormal, making it valuable for detecting subclinical liver damage. Persistently high GGT can indicate chronic liver conditions, alcohol-related liver disease, non-alcoholic fatty liver disease (NAFLD), or bile duct disorders. It''s also associated with cardiovascular disease risk and metabolic syndrome, as liver health closely connects to overall metabolic function.

Beyond liver disease, GGT elevations may signal increased oxidative stress throughout the body. Optimal GGT levels suggest healthy liver function, efficient detoxification processes, and good bile flow—all essential for digesting fats, absorbing nutrients, and eliminating waste products. Monitoring GGT trends over time provides insight into how lifestyle changes or treatments are affecting liver health.

### Key Factors

- **Alcohol consumption**: Even moderate drinking can significantly elevate GGT, often more than other liver enzymes
- **Medications**: Many drugs including statins, antibiotics, anti-seizure medications, and some antidepressants can raise GGT levels
- **Obesity and metabolic syndrome**: Excess body fat, especially visceral fat, commonly increases GGT
- **Non-alcoholic fatty liver disease (NAFLD)**: Fat accumulation in the liver raises GGT independent of alcohol use
- **Bile duct obstruction**: Gallstones or other blockages cause marked GGT elevation', 'claude-sonnet-4-5-20250929', 'e082b0a1', '2026-03-19 07:06:50.685409+00', '2026-03-19 07:06:50.427+00'),
	('d941758b-12ae-405f-8b01-a87173a56f5e', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', '# Estradiol

### What It Measures

Estradiol (E2) is the most potent and prevalent form of estrogen in the human body. It''s a steroid hormone produced primarily by the ovaries in premenopausal women, though smaller amounts are also synthesized in the adrenal glands, fat tissue, and testes in men. In women, estradiol production follows a cyclical pattern throughout the menstrual cycle, with levels rising during the follicular phase, peaking just before ovulation, and then declining if pregnancy doesn''t occur. The hormone is created through a biochemical pathway that converts testosterone into estradiol via an enzyme called aromatase. This measurement captures circulating estradiol levels at a specific point in time, providing insight into reproductive function, hormonal balance, and metabolic health.

### Why It Matters

Estradiol plays crucial roles beyond reproduction, influencing bone density, cardiovascular health, brain function, skin elasticity, and mood regulation. In women of reproductive age, appropriate estradiol levels support regular menstrual cycles, fertility, and pregnancy maintenance. Low levels may indicate ovarian insufficiency, menopause, or hypothalamic-pituitary dysfunction, potentially leading to irregular periods, infertility, bone loss, and increased cardiovascular risk. Elevated estradiol can signal ovarian tumors, certain medications, or hormonal imbalances that may increase risks for estrogen-sensitive conditions.

In men, estradiol must remain in careful balance—too little may affect bone health and libido, while too much (often from excessive aromatization of testosterone) can cause gynecomastia, mood changes, and metabolic issues. During menopause, declining estradiol levels correlate with many characteristic symptoms including hot flashes, sleep disturbances, and accelerated bone loss, which is why this biomarker is essential for evaluating menopausal status and hormone therapy effectiveness.

### Key Factors

- **Menstrual cycle phase**: Levels fluctuate significantly throughout the monthly cycle in premenopausal women
- **Age and menopausal status**: Production declines sharply during perimenopause and menopause
- **Body composition**: Adipose tissue produces estradiol through aromatization, affecting levels in both sexes
- **Hormone therapy**: Birth control pills, hormone replacement therapy, and testosterone supplementation all impact estradiol
- **Medications**: Aromatase inhibitors, some chemotherapy drugs, and certain psychiatric medications can alter levels
- **Time of day**: Slight diurnal variation exists, though less pronounced than some other hormones', 'claude-sonnet-4-5-20250929', '8eca6351', '2026-03-19 07:05:47.867426+00', '2026-03-19 07:05:47.532+00'),
	('ee3bac61-f9ad-490a-844a-86c0e57c3263', '78c24a5d-b909-4e85-86c9-60ae7eca06a9', '# Fibrinogen

### What It Measures

Fibrinogen is a soluble protein produced by your liver that plays a crucial role in blood clotting and wound healing. When you sustain an injury, fibrinogen converts into fibrin—a sticky, thread-like mesh that forms the structural framework of blood clots, helping to stop bleeding and begin tissue repair. Beyond its clotting function, fibrinogen is also classified as an acute phase reactant, meaning your liver produces more of it in response to inflammation, infection, or tissue damage anywhere in the body.

As both a clotting factor and inflammatory marker, fibrinogen levels reflect two important aspects of your health: your blood''s ability to form clots when needed, and the presence of inflammatory processes occurring in your body. Elevated levels typically indicate active inflammation, while very low levels may suggest impaired clotting ability or advanced liver disease.

### Why It Matters

Fibrinogen serves as a valuable indicator of systemic inflammation and cardiovascular risk. Chronically elevated fibrinogen levels are associated with increased risk of heart attack, stroke, and peripheral vascular disease—not just because inflammation damages blood vessels, but also because higher fibrinogen makes blood more viscous and prone to inappropriate clotting. This dual mechanism makes fibrinogen particularly important for assessing cardiovascular health beyond traditional cholesterol markers.

Clinically, fibrinogen helps distinguish between different types of health concerns. Acute elevations often accompany infections, autoimmune flare-ups, or recent injuries, while persistently high levels may reflect chronic inflammatory conditions like rheumatoid arthritis, inflammatory bowel disease, or metabolic syndrome. Very low fibrinogen can indicate serious conditions like advanced liver failure (since the liver produces fibrinogen) or disseminated intravascular coagulation (DIC), a dangerous condition where clotting factors become depleted.

### Key Factors

- **Acute illness**: Infections, injuries, or surgery trigger increased production within hours to days
- **Chronic inflammation**: Autoimmune diseases, obesity, and metabolic syndrome cause persistently elevated levels
- **Lifestyle factors**: Smoking, sedentary behavior, and poor diet contribute to higher baseline fibrinogen
- **Hormones**: Pregnancy and estrogen-containing medications typically increase fibrinogen levels
- **Liver function**: Severe liver disease impairs fibrinogen production, leading to low levels', 'claude-sonnet-4-5-20250929', 'f8f901e1', '2026-03-19 07:06:12.399351+00', '2026-03-19 07:06:12.113+00'),
	('fe8310b7-396b-44db-a3a5-9019a51f9063', '44275c87-03aa-4b77-b736-cc5d68880ce4', '# Follicle-Stimulating Hormone (FSH)

## What It Measures

Follicle-stimulating hormone (FSH) is a key reproductive hormone produced by the pituitary gland, a pea-sized structure at the base of your brain. In women, FSH stimulates the ovaries to develop follicles—the fluid-filled sacs that contain developing eggs—and triggers estrogen production. Each menstrual cycle begins with a rise in FSH that prepares the ovaries for ovulation. In men, FSH acts on the testes to support sperm production by stimulating specialized cells called Sertoli cells, which nurture developing sperm.

FSH levels fluctuate naturally throughout life and, in women, throughout the menstrual cycle. The pituitary releases FSH in response to signals from the hypothalamus and adjusts production based on feedback from sex hormones (estrogen in women, testosterone in men). This feedback loop maintains reproductive function and hormonal balance.

## Why It Matters

FSH serves as a valuable marker of reproductive health and aging. In women, elevated FSH typically indicates diminishing ovarian reserve—the ovaries have fewer remaining eggs and produce less estrogen, causing the pituitary to increase FSH output to compensate. This pattern is characteristic of perimenopause and menopause. Very high FSH levels in premenopausal women may signal premature ovarian insufficiency, while low levels could indicate pituitary dysfunction or hypothalamic disorders.

In men, elevated FSH often reflects testicular dysfunction or damage, as the pituitary increases FSH production when the testes aren''t responding normally. Low FSH in men might point to pituitary or hypothalamic problems affecting fertility. FSH testing is commonly used in fertility evaluations for both sexes, helping clinicians assess egg or sperm production potential and diagnose hormonal imbalances affecting reproductive capability.

## Key Factors

- **Age and reproductive stage**: FSH rises naturally during perimenopause/menopause in women; remains more stable in men until older age
- **Menstrual cycle timing**: In premenopausal women, FSH varies throughout the cycle (typically tested on day 3 for baseline assessment)
- **Hormonal medications**: Birth control pills, hormone replacement therapy, and fertility treatments can suppress or alter FSH levels
- **Ovarian or testicular health**: Conditions affecting the gonads directly impact FSH through feedback mechanisms
- **Body weight**: Significant weight changes can influence reproductive hormones and FSH production
- **Stress and chronic illness**: Severe physical or psychological stress may temporarily disrupt the hormonal axis controlling FSH', 'claude-sonnet-4-5-20250929', 'e7eae606', '2026-03-19 07:06:37.694049+00', '2026-03-19 07:06:37.419+00'),
	('9c59fb5d-aa2e-47e1-9858-ad80ec1bd25b', 'c59c5228-d5d5-4a70-806e-70170982b135', '# Glucose (Fasting)

### What It Measures

Fasting glucose measures the concentration of sugar (glucose) in your bloodstream after an overnight fast, typically 8-12 hours without food or caloric beverages. This test captures your baseline blood sugar level—the amount of glucose circulating in your blood when your body isn''t actively processing food. Glucose is your body''s primary energy source, derived from carbohydrates you eat and stored reserves in your liver. When you fast, your liver releases stored glucose to maintain steady blood sugar levels, while the hormone insulin helps cells absorb glucose from the bloodstream. This delicate balance between glucose release and uptake determines your fasting glucose level.

### Why It Matters

Fasting glucose is a cornerstone marker for assessing how well your body regulates blood sugar, which is fundamental to metabolic health. Consistently elevated fasting glucose indicates your body is struggling to clear sugar from the bloodstream, often due to insulin resistance—when cells don''t respond effectively to insulin''s signals. Over time, this can progress from prediabetes to type 2 diabetes, increasing risks for cardiovascular disease, nerve damage, kidney problems, and vision loss. Optimal fasting glucose levels suggest your metabolism is efficiently managing energy, your pancreas is producing appropriate insulin, and your cells are responding properly to that insulin. Even modest elevations above optimal ranges can signal early metabolic dysfunction years before diabetes develops, making this an important preventive health marker.

### Key Factors

- **Diet composition**: High intake of refined carbohydrates, added sugars, and processed foods can elevate fasting glucose over time
- **Body composition**: Excess body fat, particularly around the abdomen, promotes insulin resistance
- **Physical activity**: Regular exercise improves insulin sensitivity and glucose uptake by muscles
- **Sleep quality**: Poor or insufficient sleep disrupts glucose metabolism and increases insulin resistance
- **Stress and cortisol**: Chronic stress raises cortisol levels, which stimulates glucose release from the liver
- **Medications**: Corticosteroids, certain antipsychotics, and some blood pressure medications can raise blood sugar
- **Fasting duration**: Insufficient fasting time (less than 8 hours) may yield falsely elevated results', 'claude-sonnet-4-5-20250929', 'de2ee136', '2026-03-19 07:07:03.683269+00', '2026-03-19 07:07:03.368+00'),
	('c9103f71-c706-455f-9e10-b882b0a06a49', '216dd455-f0ea-4337-9607-ceaf1bf806dd', '# HbA1c (Hemoglobin A1c)

### What It Measures

HbA1c, or glycated hemoglobin, measures the percentage of your red blood cells that have glucose molecules permanently attached to them. When glucose circulates in your bloodstream, it naturally binds to hemoglobin—the oxygen-carrying protein inside red blood cells. Unlike blood glucose tests that capture a single moment in time, HbA1c provides a window into your average blood sugar control over the past 2-3 months, reflecting the typical 120-day lifespan of red blood cells.

This biomarker essentially acts as a "glucose memory" test. The higher your average blood glucose has been during that period, the more glucose will have attached to your hemoglobin, resulting in a higher HbA1c percentage. This makes it an invaluable tool for understanding long-term glucose metabolism rather than day-to-day fluctuations.

### Why It Matters

HbA1c is the gold standard for diagnosing and monitoring diabetes and prediabetes. Chronically elevated levels indicate that cells throughout your body have been exposed to excess glucose, which can damage blood vessels, nerves, kidneys, eyes, and the cardiovascular system over time. Even modest elevations increase the risk of microvascular complications, making early detection and management critical.

Beyond diabetes management, HbA1c helps assess metabolic health more broadly. It reflects how effectively your body regulates blood sugar through the intricate balance of insulin production, cellular insulin sensitivity, and glucose utilization. Optimal levels suggest well-functioning metabolic machinery, while rising values can signal insulin resistance—a precursor to numerous chronic conditions including cardiovascular disease, fatty liver, and cognitive decline.

### Key Factors

- **Diet composition**: High intake of refined carbohydrates and added sugars drives glucose levels upward
- **Physical activity**: Regular exercise improves insulin sensitivity and glucose uptake by muscles
- **Body composition**: Excess visceral fat promotes insulin resistance
- **Medications**: Corticosteroids, certain antipsychotics, and thiazide diuretics can raise levels
- **Red blood cell lifespan**: Conditions affecting RBC turnover (anemia, recent blood loss) may alter results
- **Sleep quality**: Poor or insufficient sleep impairs glucose regulation
- **Chronic stress**: Elevated cortisol levels can increase blood glucose', 'claude-sonnet-4-5-20250929', 'f4dd2c80', '2026-03-19 07:07:16.841387+00', '2026-03-19 07:07:16.587+00'),
	('46a279e6-76dd-4866-9829-01389c40c795', '9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', '# Hematocrit

## What It Measures

Hematocrit measures the percentage of your blood volume that consists of red blood cells. When a blood sample is spun in a centrifuge, the heavier red blood cells settle to the bottom, creating distinct layers. The hematocrit value represents the proportion of that red blood cell layer compared to the total blood volume. For example, a hematocrit of 45% means that nearly half of your blood volume is composed of red blood cells, while the remainder is plasma (the liquid portion) and white blood cells.

This measurement is closely related to hemoglobin levels, as both reflect your blood''s oxygen-carrying capacity. Red blood cells contain hemoglobin, the protein that binds oxygen in your lungs and delivers it throughout your body. The hematocrit essentially tells us how densely packed with these oxygen-transporting cells your blood is.

## Why It Matters

Hematocrit is a fundamental indicator of your blood''s ability to deliver oxygen to tissues and organs. Low hematocrit (anemia) means your blood carries less oxygen, potentially causing fatigue, weakness, shortness of breath, and reduced exercise tolerance. This can result from various conditions including iron deficiency, vitamin deficiencies, chronic disease, blood loss, or bone marrow problems.

Conversely, elevated hematocrit means your blood is thicker and more viscous, which can increase the risk of blood clots, stroke, and heart complications. High values may indicate dehydration (temporarily concentrating red blood cells), chronic lung disease (your body compensates for low oxygen by producing more red blood cells), living at high altitude, or conditions like polycythemia vera where the body overproduces red blood cells. Optimal hematocrit levels ensure efficient oxygen delivery while maintaining appropriate blood viscosity for smooth circulation through small blood vessels.

## Key Factors

- **Hydration status**: Dehydration artificially elevates hematocrit by reducing plasma volume, while overhydration can lower it
- **Altitude**: Living at higher elevations stimulates red blood cell production to compensate for lower oxygen availability
- **Iron and vitamin intake**: Iron, vitamin B12, and folate are essential for red blood cell production
- **Physical training**: Endurance athletes may develop slightly different baseline values due to training adaptations
- **Testosterone levels**: This hormone stimulates red blood cell production, contributing to typically higher hematocrit in males', 'claude-sonnet-4-5-20250929', '53a78580', '2026-03-19 07:07:43.479195+00', '2026-03-19 07:07:43.201+00'),
	('a26dabd1-938d-4813-856e-19a494964fcf', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', '# HDL Cholesterol

### What It Measures

HDL (High-Density Lipoprotein) cholesterol is often called "good cholesterol" because of its protective role in cardiovascular health. HDL particles act as microscopic transport vehicles that travel through your bloodstream collecting excess cholesterol from your arteries and tissues, then shuttling it back to your liver for disposal or recycling. Think of HDL as your body''s cleanup crew—these dense, protein-rich particles essentially reverse the cholesterol buildup process that can lead to arterial plaque formation.

The measurement reflects the concentration of cholesterol being carried by HDL particles in your blood. Unlike other cholesterol measurements that indicate risk when elevated, HDL cholesterol follows an inverse relationship with cardiovascular disease: higher levels are generally better, as they indicate more robust reverse cholesterol transport.

### Why It Matters

HDL cholesterol serves as one of the most important predictors of cardiovascular health. Beyond simply transporting cholesterol away from arteries, HDL particles have anti-inflammatory and antioxidant properties that help protect blood vessel walls from damage. Low HDL levels—typically below 40 mg/dL for men and 50 mg/dL for women—significantly increase the risk of heart attack and stroke, even when total cholesterol levels appear normal.

Optimal HDL levels (generally above 60 mg/dL) are associated with reduced cardiovascular disease risk and may even help stabilize or reverse existing arterial plaque. However, context matters: extremely high HDL levels don''t always provide additional protection, and in rare genetic conditions, they may actually be dysfunctional. HDL cholesterol should be interpreted alongside other lipid markers, particularly triglycerides and LDL cholesterol, to get a complete picture of cardiovascular risk.

### Key Factors

- **Exercise**: Regular aerobic activity is one of the most effective ways to raise HDL levels
- **Body weight**: Obesity and metabolic syndrome typically lower HDL cholesterol
- **Smoking**: Tobacco use significantly reduces HDL and impairs its protective functions
- **Diet**: Trans fats lower HDL, while healthy fats (omega-3s, monounsaturated fats) may raise it
- **Alcohol consumption**: Moderate intake may increase HDL, though this isn''t recommended as a health strategy
- **Genetics**: HDL levels are highly heritable, with significant variation among individuals and ethnic groups
- **Gender and hormones**: Estrogen raises HDL, so women typically have higher levels than men; levels may drop after menopause', 'claude-sonnet-4-5-20250929', '1c375816', '2026-03-19 07:07:29.939429+00', '2026-03-19 07:07:29.677+00'),
	('6c28c3b7-f533-4efe-89ae-e029b2155856', '08809836-cb1e-41d7-8307-1088b6f14c5e', '# Hemoglobin

### What It Measures

Hemoglobin is an iron-containing protein found inside red blood cells that serves as your body''s primary oxygen transport system. Each hemoglobin molecule contains four iron atoms that bind to oxygen in the lungs, carry it through the bloodstream, and release it to tissues throughout the body. When you measure hemoglobin levels, you''re essentially assessing your blood''s oxygen-carrying capacity—how effectively your circulatory system can deliver oxygen to every cell, from your brain to your muscles to your organs.

This measurement reflects both the quantity of red blood cells and the amount of hemoglobin packed into each cell. It provides a snapshot of your body''s ability to meet its oxygen demands, which is fundamental to energy production, cellular metabolism, and virtually every biological process.

### Why It Matters

Hemoglobin levels directly impact how energized and functional you feel. Low hemoglobin (anemia) means your tissues aren''t receiving adequate oxygen, leading to fatigue, weakness, shortness of breath, dizziness, and reduced exercise tolerance. Chronic anemia can strain the heart as it works harder to compensate for reduced oxygen delivery. Causes range from iron deficiency and nutritional deficiencies to chronic diseases, blood loss, or inherited conditions affecting red blood cell production.

Elevated hemoglobin can indicate dehydration (concentrated blood) or conditions where the body produces excess red blood cells, sometimes in response to chronic low oxygen states like living at high altitude or lung disease. Very high levels can thicken the blood, potentially increasing risks of clotting. Optimal hemoglobin levels ensure efficient oxygen delivery throughout the body, supporting physical performance, cognitive function, immune response, and overall vitality.

### Key Factors

- **Iron intake and absorption**: Dietary iron availability and gut absorption directly affect hemoglobin production
- **Nutritional status**: Vitamin B12, folate, and copper deficiencies can impair red blood cell formation
- **Hydration level**: Dehydration concentrates the blood, artificially elevating hemoglobin readings
- **Altitude and oxygen exposure**: Living at high elevations stimulates increased red blood cell production
- **Menstrual blood loss**: Regular menstruation increases iron requirements and can lower hemoglobin in women
- **Chronic inflammation or disease**: Conditions like kidney disease, autoimmune disorders, or chronic infections can suppress production
- **Genetics**: Inherited conditions like thalassemia or sickle cell trait affect hemoglobin structure and levels', 'claude-sonnet-4-5-20250929', '56aa1f56', '2026-03-19 07:07:57.328427+00', '2026-03-19 07:07:56.995+00'),
	('ab5271c0-f0e4-462c-9508-c6f6e5c1e231', '4e0eaace-4c16-4c5c-a174-b7fd33249f9b', '# Hg, Mercury

## What It Measures

Mercury testing measures the concentration of mercury in your blood, typically expressed in micrograms per liter (μg/L). Mercury is a heavy metal that exists in several forms—elemental (liquid metal), inorganic (salts), and organic (particularly methylmercury). Blood mercury levels primarily reflect recent exposure to organic methylmercury, which is the form most commonly encountered through dietary sources, especially fish and seafood. Unlike some biomarkers that naturally occur in the body and serve biological functions, mercury has no known beneficial role in human physiology and is purely a marker of environmental or occupational exposure.

The body does not require or produce mercury—its presence indicates external exposure. Once absorbed, mercury distributes throughout the body and can cross both the blood-brain barrier and placental barrier, making monitoring particularly important for certain populations. Blood tests capture relatively recent exposures (past few months), while other tests like hair or urine analysis can provide different exposure timeframes.

## Why It Matters

Mercury is a neurotoxin that can affect the nervous system, kidneys, and cardiovascular system when accumulated in excessive amounts. Chronic exposure to elevated mercury levels has been associated with cognitive impairment, sensory disturbances (particularly affecting vision, hearing, and touch), tremors, and kidney dysfunction. For pregnant women, mercury exposure is especially concerning because methylmercury can harm fetal brain development, potentially affecting cognitive abilities, attention, and motor skills in children.

Low or undetectable mercury levels generally indicate minimal exposure and are considered ideal. While our bodies have some capacity to eliminate mercury over time, regular monitoring helps identify problematic exposure patterns before health effects develop. Individuals who consume large amounts of certain fish species, have occupational exposures (dental workers, mining, manufacturing), or live in areas with known mercury contamination may benefit from periodic testing.

## Key Factors

- **Fish and seafood consumption**: Predatory fish (shark, swordfish, king mackerel, tilefish, tuna) accumulate higher methylmercury levels
- **Occupational exposure**: Dental amalgam work, gold mining, chlor-alkali plant work, medical equipment manufacturing
- **Geographic location**: Living near industrial sites, coal-fired power plants, or artisanal mining areas
- **Dental amalgam fillings**: Silver fillings contain elemental mercury and contribute small amounts through vapor release
- **Traditional or cultural practices**: Certain medicinal preparations, skin-lightening creams, or ceremonial uses of mercury', 'claude-sonnet-4-5-20250929', '5a137459', '2026-03-19 07:08:19.494473+00', '2026-03-19 07:08:19.209+00'),
	('33280f5f-167a-4172-b8f8-53d8db91094c', '2eff0519-c47b-44ed-b605-a698e1f47dbc', '# HOMA-IR (Homeostatic Model Assessment of Insulin Resistance)

### What It Measures

HOMA-IR is a calculated index that estimates how effectively your body''s cells respond to insulin, the hormone responsible for allowing glucose to enter cells for energy. Rather than measuring a single substance in your blood, HOMA-IR is derived from your fasting glucose and fasting insulin levels using a mathematical formula. This calculation provides a snapshot of the dynamic relationship between these two critical metabolic markers.

The index essentially quantifies insulin resistance—a condition where your cells become less responsive to insulin''s signals. When cells don''t respond well to insulin, your pancreas must produce increasingly higher amounts of insulin to achieve the same glucose-lowering effect. HOMA-IR captures this compensatory mechanism, with higher values indicating greater insulin resistance and lower values suggesting better insulin sensitivity.

### Why It Matters

Insulin resistance is a cornerstone metabolic dysfunction that precedes and drives many chronic health conditions. It''s the primary underlying factor in type 2 diabetes development, often appearing years before blood sugar levels become clinically elevated. Beyond diabetes, insulin resistance is strongly linked to metabolic syndrome, cardiovascular disease, fatty liver disease, polycystic ovary syndrome (PCOS), and certain cancers.

When insulin resistance develops, your body enters a metabolic state that promotes fat storage (particularly visceral fat around organs), inflammation, and hormonal imbalances. Early detection through HOMA-IR allows for lifestyle interventions before irreversible damage occurs. Improving insulin sensitivity through diet, exercise, and weight management can dramatically reduce disease risk and enhance overall metabolic health. Optimal HOMA-IR values indicate that your cells efficiently use insulin and glucose, reflecting metabolic flexibility and reduced disease risk.

### Key Factors

- **Body composition**: Excess body fat, especially visceral (abdominal) fat, is the strongest driver of insulin resistance
- **Physical activity**: Regular exercise, particularly strength training and high-intensity intervals, enhances insulin sensitivity
- **Dietary patterns**: High intake of refined carbohydrates, sugar, and processed foods worsens resistance; whole foods and fiber improve it
- **Sleep quality**: Poor sleep and sleep disorders like sleep apnea significantly increase insulin resistance
- **Chronic stress**: Elevated cortisol from ongoing stress impairs insulin signaling and promotes glucose production', 'claude-sonnet-4-5-20250929', '4e1953c', '2026-03-19 07:08:46.399708+00', '2026-03-19 07:08:46.139+00'),
	('4208c668-07ab-4a23-a268-a3803645a4c8', 'c1ecae4e-6b1b-4b32-a5f9-c6ebfe8240ef', '# hs-CRP (High-Sensitivity C-Reactive Protein)

## What It Measures

High-sensitivity C-reactive protein (hs-CRP) is a protein produced by your liver in response to inflammation anywhere in your body. Unlike standard CRP tests that measure higher levels of inflammation (such as during acute infections), the hs-CRP test is designed to detect very low levels of chronic, systemic inflammation—the kind that may persist quietly for months or years without obvious symptoms.

When your body experiences tissue damage, infection, or other inflammatory triggers, immune cells release signaling molecules called cytokines that travel to the liver and stimulate CRP production. The protein then circulates in your bloodstream, where it helps activate your immune system and marks damaged cells for removal. The "high-sensitivity" aspect means this test can pick up subtle elevations that standard tests would miss, making it particularly useful for assessing cardiovascular and metabolic health.

## Why It Matters

Chronically elevated hs-CRP levels are associated with increased risk for cardiovascular disease, including heart attack and stroke. Even when cholesterol levels appear normal, elevated hs-CRP can indicate underlying arterial inflammation that contributes to plaque buildup and instability. Many healthcare providers use hs-CRP alongside traditional cholesterol measurements to get a more complete picture of cardiovascular risk.

Beyond heart health, persistently high hs-CRP levels may reflect chronic conditions such as autoimmune disorders, obesity-related metabolic inflammation, or uncontrolled inflammatory diseases. Lower hs-CRP levels generally indicate less systemic inflammation and are associated with better overall health outcomes. However, because hs-CRP is a nonspecific marker—it rises in response to many types of inflammation—an elevated result warrants investigation into the underlying cause rather than serving as a diagnosis on its own.

## Key Factors

- **Obesity and body fat distribution**: Visceral fat (around organs) actively produces inflammatory signals that raise hs-CRP
- **Physical activity**: Regular exercise tends to lower chronic inflammation, while sedentary behavior increases it
- **Diet quality**: Highly processed foods, refined sugars, and trans fats can elevate hs-CRP; anti-inflammatory foods like fatty fish, vegetables, and whole grains may lower it
- **Infections and acute illness**: Recent colds, infections, or injuries cause temporary spikes in hs-CRP
- **Smoking and alcohol**: Both tobacco use and excessive alcohol consumption increase systemic inflammation
- **Chronic stress and sleep quality**: Poor sleep and psychological stress can elevate inflammatory markers over time
- **Certain medications**: Statins and anti-inflammatory drugs may lower hs-CRP levels', 'claude-sonnet-4-5-20250929', 'a70b8a8', '2026-03-19 07:09:30.64382+00', '2026-03-19 07:09:30.303+00'),
	('6f0ad1a4-6133-485c-90d1-ae8369cae649', '6fb70d01-c5f1-442b-bded-a56e942a354b', '# Immunoglobulin A (IgA)

## What It Measures

Immunoglobulin A (IgA) is an antibody protein that forms a crucial part of your body''s immune defense system, particularly at mucosal surfaces. It''s the most abundant antibody type in your body''s secretions—including saliva, tears, breast milk, and the mucus lining your respiratory and digestive tracts. Blood IgA levels reflect the amount of this antibody circulating in your serum, which represents only about 10-15% of total body IgA. The remaining majority resides in mucous membranes where it acts as the first line of defense against pathogens entering through the nose, mouth, lungs, and gut. Your body produces IgA primarily in response to infections and exposure to foreign substances, making it a key indicator of immune system function.

## Why It Matters

IgA levels provide insight into both your immune system''s capacity and potential immune disorders. Elevated IgA can signal chronic infections, autoimmune conditions (particularly those affecting the liver, kidneys, or connective tissue), or certain cancers like multiple myeloma. However, moderate increases are sometimes seen during acute infections as part of a normal immune response. Low IgA (selective IgA deficiency) is one of the most common immunodeficiencies, affecting approximately 1 in 300-700 people. While many people with low IgA remain healthy, others experience recurrent respiratory or gastrointestinal infections, allergies, or autoimmune conditions. Significantly low levels may also occur in certain genetic disorders or as a side effect of some medications. Understanding your IgA status helps assess infection risk and can guide decisions about vaccinations, blood transfusions (some IgA-deficient individuals develop antibodies against IgA), and monitoring for associated conditions.

## Key Factors

- **Infections**: Chronic or recurrent bacterial, viral, or parasitic infections can elevate IgA levels
- **Autoimmune diseases**: Conditions like rheumatoid arthritis, lupus, and inflammatory bowel disease often affect IgA production
- **Medications**: Certain drugs, including some anticonvulsants and immunosuppressants, can lower IgA levels
- **Genetics**: Selective IgA deficiency runs in families and is linked to specific genetic variations
- **Age**: IgA levels are naturally lower in infants and young children, reaching adult levels around age 10-12', 'claude-sonnet-4-5-20250929', '5cfe990e', '2026-03-19 07:09:43.866464+00', '2026-03-19 07:09:43.597+00'),
	('7ef6df9d-4d74-4d63-9c17-5089e2fc3bd7', 'c714ce8e-c022-4469-a7ea-1c2ba37e57a9', '# Immunoglobulin G (IgG)

## What It Measures

Immunoglobulin G (IgG) is the most abundant type of antibody in your bloodstream, making up approximately 75-80% of all antibodies circulating in your body. These Y-shaped proteins are produced by specialized white blood cells called plasma cells and serve as your immune system''s long-term memory and defense force. IgG antibodies recognize and bind to specific foreign invaders—bacteria, viruses, fungi, and toxins—marking them for destruction by other immune cells. Unlike other antibody types that provide immediate or localized protection, IgG represents your body''s sustained immune response, developed over time through exposure to pathogens or vaccinations.

The concentration of IgG in your blood reflects your immune system''s readiness to defend against previously encountered threats. Once your body has fought off an infection or received a vaccine, it retains the "blueprint" for producing specific IgG antibodies, allowing for rapid response if you encounter that pathogen again. This is the biological basis of immunity and why you typically don''t get the same infection twice.

## Why It Matters

IgG levels are clinically significant because both elevated and decreased values can signal important health conditions. Low IgG (hypogammaglobulinemia) weakens your immune defenses, leaving you vulnerable to recurrent infections, particularly of the respiratory tract, sinuses, and ears. This can occur due to genetic immune deficiencies, certain medications, kidney disease that causes protein loss, or conditions that affect antibody production.

Elevated IgG levels may indicate chronic infections, autoimmune diseases where the immune system attacks the body''s own tissues, or liver disease. In some cases, very high IgG can signal multiple myeloma or other plasma cell disorders where antibody-producing cells multiply uncontrollably. However, moderately elevated levels are often less concerning and may simply reflect an active or recent immune response to infection.

IgG testing is particularly valuable for diagnosing immune deficiencies, monitoring chronic inflammatory conditions, and assessing vaccination responses in immunocompromised individuals.

## Key Factors

- **Chronic infections or inflammation**: Prolonged immune activation drives increased IgG production
- **Autoimmune conditions**: Diseases like lupus or rheumatoid arthritis often elevate IgG levels
- **Immunodeficiency disorders**: Genetic conditions or acquired states that impair antibody production lower IgG
- **Medications**: Immunosuppressants, chemotherapy, and certain biologics can reduce IgG levels
- **Age**: IgG levels naturally increase from infancy through adulthood, with some decline in elderly populations
- **Kidney or gastrointestinal disease**: Protein-losing conditions can decrease circulating IgG', 'claude-sonnet-4-5-20250929', 'dd6eabc8', '2026-03-19 07:09:59.04992+00', '2026-03-19 07:09:58.787+00'),
	('e209e6ce-ba30-499b-af8d-dcae5482394f', 'e7aa8c83-8eda-45be-953c-70954c9e7e0e', '# IgM (Immunoglobulin M)

## What It Measures

IgM is one of five major types of antibodies (immunoglobulins) produced by your immune system. It''s the largest antibody molecule and the first line of defense your body deploys when encountering a new infection or foreign substance. When your immune system detects bacteria, viruses, or other pathogens it hasn''t seen before, specialized white blood cells called B lymphocytes rapidly produce IgM antibodies. These antibodies circulate in your bloodstream and lymphatic fluid, acting like biological sentries that identify and mark invaders for destruction by other immune cells.

IgM antibodies are particularly effective at clumping pathogens together (a process called agglutination) and activating the complement system—a cascade of proteins that directly destroys microbes. Because IgM appears quickly during acute infections but typically declines as other, more specific antibodies (like IgG) take over, measuring IgM levels provides insight into your immune system''s immediate responsiveness and overall immunological health.

## Why It Matters

IgM levels serve as an important indicator of both acute immune responses and chronic immune function. Elevated IgM often signals a recent or ongoing infection, as your body ramps up production to fight off invaders. However, persistently high levels might indicate chronic infections, certain autoimmune conditions where the immune system remains constantly activated, or rare disorders affecting antibody production.

Low IgM levels can be more concerning, potentially indicating immunodeficiency disorders that leave you vulnerable to recurrent infections. Some people are born with selective IgM deficiency, while others may develop reduced levels due to certain medications, cancers affecting immune cells, or protein-losing conditions. Monitoring IgM is particularly valuable in patients with recurrent infections, suspected immune disorders, or those undergoing treatments that might suppress immune function.

## Key Factors

- **Acute infections**: Bacterial, viral, or parasitic infections trigger rapid IgM production
- **Age**: IgM levels are typically lower in newborns and gradually increase through childhood
- **Autoimmune conditions**: Disorders like lupus or rheumatoid arthritis may elevate IgM
- **Immunosuppressive medications**: Corticosteroids, chemotherapy, and certain biologics can reduce IgM production
- **Chronic liver disease**: The liver plays a role in clearing antibodies; dysfunction may affect levels
- **Recent vaccinations**: Some vaccines may temporarily increase IgM as part of the normal immune response', 'claude-sonnet-4-5-20250929', '97380482', '2026-03-19 07:10:13.422895+00', '2026-03-19 07:10:13.153+00'),
	('99999871-9274-432c-8bc1-3c046474dea6', 'f269ef8f-3b2d-444c-b26a-03b45d082b94', '# Insulin (Fasting)

### What It Measures

Fasting insulin measures the baseline amount of insulin hormone circulating in your blood after an overnight fast, typically 8-12 hours without food. Insulin is produced by beta cells in the pancreas and serves as the master regulator of glucose (blood sugar) metabolism. When you eat, your blood glucose rises, triggering insulin release to help shuttle that glucose into cells for energy or storage. A fasting measurement captures your body''s baseline insulin production when it''s not responding to food intake.

This biomarker provides insight into how hard your pancreas is working to maintain normal blood sugar levels. In healthy metabolism, only a small amount of insulin is needed during fasting to keep glucose stable. However, when cells become resistant to insulin''s signals—a condition called insulin resistance—the pancreas compensates by producing more insulin to achieve the same glucose control.

### Why It Matters

Fasting insulin is one of the earliest indicators of metabolic dysfunction, often becoming elevated years before blood glucose levels rise into prediabetic or diabetic ranges. Chronically elevated fasting insulin suggests insulin resistance, a core feature of metabolic syndrome and a major risk factor for type 2 diabetes, cardiovascular disease, fatty liver disease, and polycystic ovary syndrome (PCOS). High insulin levels also promote fat storage, making weight loss more difficult, and can contribute to inflammation throughout the body.

Conversely, optimal fasting insulin levels indicate that your cells are responding efficiently to insulin''s signals, requiring only minimal hormone production to maintain metabolic balance. Tracking this biomarker alongside fasting glucose provides a more complete picture of metabolic health than glucose alone, since insulin resistance can develop even when glucose remains normal.

### Key Factors

- **Dietary patterns**: High intake of refined carbohydrates, sugars, and frequent eating can chronically elevate insulin levels
- **Body composition**: Excess visceral (abdominal) fat strongly correlates with insulin resistance
- **Physical activity**: Regular exercise, especially resistance training, improves insulin sensitivity
- **Sleep quality**: Poor sleep and sleep disorders can impair insulin function
- **Stress levels**: Chronic stress and elevated cortisol can worsen insulin resistance
- **Medications**: Corticosteroids, certain psychiatric medications, and hormonal contraceptives may affect insulin levels', 'claude-sonnet-4-5-20250929', '9929195e', '2026-03-19 07:10:26.440585+00', '2026-03-19 07:10:26.182+00'),
	('0ed421d3-6215-4922-b2a8-17ae0d081549', 'accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', '# LDL Cholesterol

### What It Measures

LDL cholesterol, often called "bad cholesterol," measures the amount of cholesterol carried by low-density lipoprotein particles in your bloodstream. These particles act as delivery vehicles, transporting cholesterol from your liver to cells throughout your body where it''s used to build cell membranes, produce hormones, and synthesize vitamin D. The "low-density" designation refers to the fact that these particles contain more cholesterol and fat relative to protein, making them lighter and more prone to depositing cholesterol into artery walls.

When measured in a lipid panel, LDL cholesterol typically represents calculated values based on total cholesterol, HDL cholesterol, and triglycerides, though direct measurement methods are also available. This biomarker specifically quantifies the cholesterol content within LDL particles, not the particle number itself, which is an important distinction in advanced cardiovascular risk assessment.

### Why It Matters

LDL cholesterol is one of the most important cardiovascular risk markers because elevated levels contribute directly to atherosclerosis—the buildup of fatty plaques in artery walls. When LDL particles become oxidized or modified, they can penetrate damaged arterial linings and trigger inflammatory responses that lead to plaque formation. Over time, these plaques narrow arteries, reduce blood flow, and can rupture, causing heart attacks or strokes.

Optimal LDL levels help maintain clean, flexible arteries and reduce cardiovascular disease risk. Lower levels are generally better for heart health, though excessively low levels are rare and typically only seen with certain genetic conditions or aggressive medication regimens. This biomarker is particularly important because it responds well to lifestyle modifications and medical treatments, making it a actionable target for reducing cardiovascular risk across populations.

### Key Factors

- **Dietary fat composition**: Saturated and trans fats raise LDL, while unsaturated fats may lower it
- **Genetics**: Familial hypercholesterolemia and other inherited conditions significantly elevate LDL
- **Body weight**: Excess weight, particularly abdominal fat, tends to increase LDL levels
- **Physical activity**: Regular exercise typically lowers LDL cholesterol
- **Medications**: Statins, PCSK9 inhibitors, and other drugs specifically target LDL reduction', 'claude-sonnet-4-5-20250929', 'f837e874', '2026-03-19 07:10:52.755769+00', '2026-03-19 07:10:52.5+00'),
	('2e8bb878-6a5a-4762-9924-aba934e9fda8', '1e6e9873-a41d-495c-93f0-9eba4f7eacb6', '# LDL/HDL Ratio

### What It Measures

The LDL/HDL ratio compares the amount of low-density lipoprotein cholesterol (LDL) to high-density lipoprotein cholesterol (HDL) in your blood. This ratio provides a snapshot of the balance between "atherogenic" (potentially harmful) and "protective" cholesterol particles in your cardiovascular system. LDL cholesterol carries lipids from the liver to cells throughout the body, but excess LDL can deposit in arterial walls, contributing to plaque formation. HDL cholesterol, conversely, acts as a cleanup crew—transporting cholesterol away from arteries back to the liver for disposal. The ratio essentially captures the relationship between these opposing forces in your circulatory system.

Unlike looking at LDL or HDL in isolation, the ratio reveals the overall balance in your cholesterol transport system. A person might have acceptable individual cholesterol numbers but still have an unfavorable ratio if their protective HDL is too low relative to their LDL. This makes the ratio a particularly useful metric for assessing cardiovascular risk patterns.

### Why It Matters

The LDL/HDL ratio serves as a powerful predictor of cardiovascular disease risk, often providing more meaningful information than total cholesterol alone. A lower ratio indicates a healthier balance, with sufficient HDL to counteract LDL''s potential effects on arterial health. Higher ratios suggest an imbalance where LDL cholesterol may be accumulating faster than HDL can remove it, potentially accelerating atherosclerotic processes that narrow and stiffen arteries over time.

This biomarker is particularly valuable because it captures metabolic patterns associated with insulin resistance, inflammation, and overall lipid metabolism efficiency. An elevated ratio often accompanies conditions like metabolic syndrome, type 2 diabetes, and chronic inflammatory states—all of which increase cardiovascular risk independently. Clinicians use this ratio alongside other lipid markers to stratify risk, guide treatment intensity, and monitor the effectiveness of lifestyle modifications or lipid-lowering therapies.

### Key Factors

- **Dietary composition**: Saturated and trans fats tend to raise LDL, while omega-3 fatty acids and fiber can improve the ratio
- **Physical activity**: Regular aerobic exercise typically increases HDL levels, improving the ratio
- **Body composition**: Excess visceral fat is associated with lower HDL and higher triglycerides, worsening the ratio
- **Insulin sensitivity**: Insulin resistance often drives unfavorable lipid patterns with higher LDL/HDL ratios
- **Genetics**: Inherited conditions affecting cholesterol metabolism can significantly impact both LDL and HDL levels
- **Smoking**: Tobacco use lowers HDL cholesterol while promoting LDL oxidation, negatively affecting the ratio', 'claude-sonnet-4-5-20250929', 'e8928ae0', '2026-03-19 07:11:20.328071+00', '2026-03-19 07:11:20.047+00'),
	('6852c426-2b3e-41cd-9ff6-fac5a3b0af78', 'b1eba466-8842-4015-8af3-373f326d6794', '# Lipoprotein(a)

### What It Measures

Lipoprotein(a), often abbreviated as Lp(a), is a unique particle in your bloodstream that combines a standard LDL cholesterol molecule with an additional protein called apolipoprotein(a). Unlike other cholesterol particles that fluctuate with diet and lifestyle, Lp(a) levels are largely determined by your genetics and remain relatively stable throughout your lifetime. This biomarker is measured in nanomoles per liter (nmol/L) and reflects an inherited cardiovascular risk factor that operates independently of your traditional cholesterol levels.

The structure of Lp(a) makes it particularly problematic for arterial health. The apolipoprotein(a) component shares similarities with plasminogen, a protein involved in breaking down blood clots, which allows Lp(a) to interfere with normal clot regulation while simultaneously promoting plaque buildup in arterial walls.

### Why It Matters

Elevated Lp(a) is recognized as an independent risk factor for cardiovascular disease, including heart attack, stroke, and aortic valve stenosis. Unlike LDL cholesterol, which responds well to lifestyle modifications and statin medications, Lp(a) levels don''t significantly decrease with diet changes or most conventional cholesterol-lowering therapies. This makes it a particularly important marker to identify, as people with elevated Lp(a) may need more aggressive management of other modifiable risk factors like blood pressure, smoking, and LDL cholesterol.

Approximately 20% of the global population has elevated Lp(a) levels, though many remain unaware due to limited routine testing. Understanding your Lp(a) status helps you and your healthcare provider develop a more complete picture of cardiovascular risk and guides decisions about preventive strategies, monitoring frequency, and potentially emerging targeted therapies.

### Key Factors

- **Genetics**: Lp(a) levels are 70-90% genetically determined and remain stable throughout adulthood
- **Ethnicity**: People of African descent typically have higher average levels than other populations
- **Hormone status**: Estrogen may slightly reduce Lp(a); levels can increase after menopause or with thyroid dysfunction
- **Kidney function**: Impaired kidney function can elevate Lp(a) levels
- **Inflammation**: Acute illness or inflammatory conditions may temporarily increase measurements', 'claude-sonnet-4-5-20250929', 'aee841b7', '2026-03-19 07:11:45.263305+00', '2026-03-19 07:11:44.551+00'),
	('b613eca3-5a72-4b8f-ac39-c3da0743c433', '3885e9a3-d5df-4396-9355-33e33a56fe07', '# Interleukin-6 (IL-6)

## What It Measures

Interleukin-6 is a small signaling protein called a cytokine that serves as one of the body''s primary inflammatory messengers. Produced by various cells including immune cells, muscle cells, and fat tissue, IL-6 acts as a communication molecule that coordinates the body''s response to injury, infection, and stress. When tissues are damaged or pathogens are detected, IL-6 levels rise rapidly to activate immune defenses, trigger the production of acute-phase proteins in the liver, and regulate inflammatory processes throughout the body.

While IL-6 plays essential roles in normal immune function and tissue repair, it also serves as a sensitive indicator of systemic inflammation. Unlike inflammation markers that only reflect liver response (like CRP), IL-6 provides insight into active inflammatory signaling happening in real-time across multiple body systems, making it a valuable window into the body''s current inflammatory state.

## Why It Matters

Chronically elevated IL-6 levels are associated with numerous age-related conditions and serve as a predictor of various health outcomes. Persistent elevation has been linked to cardiovascular disease, type 2 diabetes, certain cancers, neurodegenerative conditions, and accelerated aging processes. Because IL-6 can promote insulin resistance, influence fat metabolism, and affect muscle maintenance, it sits at the intersection of metabolic health and immune function.

Optimal IL-6 levels indicate a well-regulated inflammatory response—active enough to handle threats but not chronically elevated. Transiently increased IL-6 after exercise is actually beneficial and supports muscle adaptation, but sustained elevation suggests ongoing inflammatory stress that may contribute to tissue damage over time. Monitoring IL-6 can help assess the effectiveness of lifestyle interventions aimed at reducing systemic inflammation and may provide early warning of inflammatory processes before they manifest as clinical disease.

## Key Factors

- **Acute illness and infection**: Levels spike dramatically during active infections or injury
- **Obesity**: Adipose tissue produces IL-6, with higher levels in individuals with excess body fat
- **Physical activity**: Exercise causes temporary increases (beneficial), while chronic inactivity promotes sustained elevation
- **Sleep quality**: Poor sleep and circadian disruption increase baseline IL-6 levels
- **Chronic stress**: Psychological stress activates inflammatory pathways that elevate IL-6
- **Diet**: High-sugar and processed foods promote IL-6 production, while anti-inflammatory diets reduce it', 'claude-sonnet-4-5-20250929', '891d0e00', '2026-03-19 07:10:41.180652+00', '2026-03-19 07:10:40.906+00'),
	('d68906e4-b10d-43a4-91a9-71a2eda5a58c', '98a709e6-bb1c-4c08-9609-785a25d28f5c', '# LDL Particle Number

### What It Measures

LDL particle number (LDL-P) counts the actual number of low-density lipoprotein particles circulating in your bloodstream, measured in nanomoles per liter. Unlike standard cholesterol tests that measure the *amount* of cholesterol carried by LDL particles, LDL-P tells you *how many* individual particles are present. This distinction is important because LDL particles vary in size—you could have the same total LDL cholesterol distributed across many small particles or fewer large particles.

Each LDL particle, regardless of how much cholesterol it carries, can penetrate artery walls and contribute to plaque formation. Think of it like traffic: ten small cars and five large trucks may carry similar cargo, but the ten cars create more individual opportunities for accidents. Similarly, a higher number of LDL particles creates more opportunities for atherosclerotic events, even if total cholesterol levels appear reasonable.

### Why It Matters

LDL particle number is considered by many cardiologists to be a superior predictor of cardiovascular risk compared to traditional LDL cholesterol measurements. Research has shown that people with high LDL-P but normal LDL cholesterol still face elevated heart disease risk, while those with high LDL cholesterol but low LDL-P may have lower risk than expected. This makes LDL-P particularly valuable for identifying individuals who might be missed by conventional lipid panels.

When LDL particle number is elevated, it indicates an increased likelihood of atherosclerotic cardiovascular disease, including heart attacks and strokes. Optimal levels suggest that even if cholesterol-carrying capacity exists, the actual number of atherogenic particles is minimized. This biomarker is especially useful for assessing residual risk in people whose standard cholesterol numbers have improved but who may still have elevated particle counts.

### Key Factors

- **Dietary patterns**: Refined carbohydrates and sugars tend to increase small, dense LDL particles more than dietary fat alone
- **Insulin resistance**: Metabolic syndrome and prediabetes often elevate LDL particle number independent of cholesterol levels
- **Genetics**: Familial conditions like familial hypercholesterolemia significantly increase particle production
- **Body composition**: Excess visceral (abdominal) fat correlates with higher LDL-P
- **Medications**: Statins, PCSK9 inhibitors, and other lipid-lowering therapies directly reduce particle number', 'claude-sonnet-4-5-20250929', '16db1486', '2026-03-19 07:11:06.063837+00', '2026-03-19 07:11:05.735+00'),
	('e9484d32-16ab-4729-a6b4-fc25e9cdf569', 'f57e5dfb-866b-4df2-b571-b2d17eca1896', '# Luteinizing Hormone (LH)

### What It Measures

Luteinizing hormone (LH) is a key reproductive hormone produced by the pituitary gland, a small structure at the base of your brain that acts as your body''s master hormonal control center. LH plays fundamentally different but equally critical roles in male and female reproductive systems. In women, LH surges mid-cycle to trigger ovulation—the release of an egg from the ovary—and then helps maintain progesterone production. In men, LH continuously stimulates the Leydig cells in the testes to produce testosterone. This hormone operates as part of a sophisticated feedback loop involving the hypothalamus, pituitary, and reproductive organs, collectively known as the hypothalamic-pituitary-gonadal (HPG) axis.

### Why It Matters

LH levels provide crucial insights into reproductive health, fertility potential, and hormonal balance. Abnormal LH patterns can indicate various conditions: elevated levels may suggest primary gonadal failure (where the ovaries or testes aren''t responding properly), polycystic ovary syndrome (PCOS) in women, or menopause. Low levels might point to pituitary dysfunction, hypothalamic disorders, or suppression from stress, malnutrition, or certain medications. For individuals trying to conceive, LH testing helps identify ovulation timing in women or assess whether testosterone production is adequately stimulated in men. In menopausal women, characteristically elevated LH confirms the transition. Beyond fertility, LH levels help diagnose precocious or delayed puberty, investigate menstrual irregularities, and evaluate unexplained symptoms like low libido or fatigue that might stem from hormonal imbalances.

### Key Factors

- **Menstrual cycle phase** (in women): LH varies dramatically throughout the cycle, with a sharp mid-cycle surge
- **Age and reproductive status**: Values shift significantly during puberty, reproductive years, and menopause/andropause
- **Medications**: Hormonal contraceptives, testosterone replacement, and certain psychiatric medications can suppress LH
- **Body weight and stress**: Extreme weight loss, eating disorders, or chronic stress can lower LH production
- **Time of day**: LH pulses throughout the day, with some variation in secretion patterns', 'claude-sonnet-4-5-20250929', 'cb7f1624', '2026-03-19 07:11:32.353196+00', '2026-03-19 07:11:32.101+00'),
	('c8128b00-10ff-4b67-8f53-d373a07021d6', 'b116af7b-d1b4-4218-ba0c-c54afd82a620', '# Magnesium

### What It Measures

Magnesium is an essential mineral and the fourth most abundant cation in the human body, with approximately 99% stored in bones, muscles, and soft tissues, while only about 1% circulates in blood. A serum magnesium test measures the concentration of magnesium in your blood plasma, providing a snapshot of this critical electrolyte''s status. However, it''s important to note that blood levels don''t always reflect total body magnesium stores, as the body tightly regulates serum concentrations by drawing from bone and tissue reserves when dietary intake is insufficient.

This mineral serves as a cofactor for over 300 enzymatic reactions throughout the body, playing fundamental roles in energy production, protein synthesis, DNA and RNA formation, and the regulation of other essential minerals like calcium and potassium.

### Why It Matters

Magnesium is crucial for cardiovascular health, muscle function, nerve transmission, blood sugar regulation, and bone integrity. It helps maintain normal heart rhythm, supports healthy blood pressure, and is essential for proper muscle contraction and relaxation—including the heart muscle itself. In the nervous system, magnesium acts as a natural calcium blocker, helping to regulate neurotransmitter release and potentially influencing mood, stress response, and sleep quality.

Low magnesium levels can manifest as muscle cramps, weakness, fatigue, irregular heartbeat, and in severe cases, seizures or cardiac arrhythmias. Chronic insufficiency has been associated with increased risk of type 2 diabetes, osteoporosis, migraines, and cardiovascular disease. Conversely, elevated magnesium levels are less common but can occur with kidney dysfunction or excessive supplementation, potentially causing muscle weakness, low blood pressure, and cardiac complications.

### Key Factors

- **Dietary intake**: Green leafy vegetables, nuts, seeds, whole grains, and legumes are primary sources
- **Gastrointestinal health**: Chronic diarrhea, celiac disease, Crohn''s disease, and other GI disorders impair absorption
- **Medications**: Diuretics, proton pump inhibitors, and certain antibiotics can increase magnesium loss
- **Kidney function**: The kidneys regulate magnesium excretion; impaired function can cause retention
- **Alcohol consumption**: Chronic alcohol use increases urinary magnesium excretion and reduces absorption
- **Age and chronic conditions**: Older adults and people with diabetes are at higher risk of deficiency', 'claude-sonnet-4-5-20250929', '87e3babb', '2026-03-19 07:11:57.327324+00', '2026-03-19 07:11:56.918+00'),
	('64d89dd2-fe84-4248-a352-35263287e8cb', '33d595ad-91a6-4f7c-99b2-156a44fe0d21', '# Mean Corpuscular Hemoglobin (MCH)

## What It Measures

Mean Corpuscular Hemoglobin (MCH) measures the average amount of hemoglobin contained in a single red blood cell, expressed in picograms (trillionths of a gram). Hemoglobin is the oxygen-carrying protein that gives blood its red color and enables red blood cells to transport oxygen from your lungs to every tissue in your body. 

This measurement provides insight into whether your red blood cells are carrying adequate amounts of hemoglobin. MCH is calculated by dividing the total amount of hemoglobin in your blood by the number of red blood cells, giving you an average value per cell. It works closely with other red blood cell indices like MCV (cell size) and MCHC (hemoglobin concentration) to create a complete picture of red blood cell characteristics.

## Why It Matters

MCH helps classify different types of anemia and other blood disorders by revealing whether red blood cells are properly loaded with hemoglobin. Low MCH values (hypochromic cells) suggest that red blood cells contain less hemoglobin than normal, which commonly occurs in iron deficiency anemia, where the body lacks sufficient iron to produce adequate hemoglobin. This can result in fatigue, weakness, and reduced oxygen delivery to tissues.

High MCH values typically indicate that red blood cells are larger and carrying more hemoglobin, often seen in vitamin B12 or folate deficiency anemias. While MCH rarely stands alone as a diagnostic marker, it provides crucial supporting information when evaluated alongside other complete blood count parameters. Normal MCH values generally indicate that your bone marrow is producing healthy, well-hemoglobinized red blood cells capable of efficient oxygen transport.

## Key Factors

- **Iron status**: Iron deficiency is the most common cause of low MCH
- **Vitamin B12 and folate levels**: Deficiencies can elevate MCH by producing larger cells
- **Chronic disease**: Long-term inflammatory conditions may lower MCH
- **Genetic factors**: Inherited conditions like thalassemia affect hemoglobin production
- **Medications**: Certain drugs affecting DNA synthesis or iron absorption can influence MCH values', 'claude-sonnet-4-5-20250929', 'fbf3a8ae', '2026-03-19 07:12:08.649386+00', '2026-03-19 07:12:08.377+00'),
	('aa8117b4-38d8-4fde-9c76-3038d1f02703', '3e2b80bf-c4dc-4bf4-a008-b2dbc5291480', '# Mean Corpuscular Volume (MCV)

### What It Measures

Mean Corpuscular Volume (MCV) measures the average size of your red blood cells, expressed in femtoliters (fL). Think of it as determining whether your red blood cells are smaller than normal (microcytic), normal-sized (normocytic), or larger than normal (macrocytic). This measurement is calculated by dividing your hematocrit (the percentage of blood volume occupied by red blood cells) by your total red blood cell count.

Red blood cells are responsible for carrying oxygen throughout your body via hemoglobin. The size of these cells can reveal important information about how they''re being produced in your bone marrow and whether your body has the necessary building blocks—like iron, vitamin B12, and folate—to create healthy, properly-sized cells.

### Why It Matters

MCV is a crucial diagnostic tool that helps identify different types of anemia and underlying nutritional deficiencies. Small red blood cells (low MCV) often indicate iron deficiency or thalassemia, conditions where the cells can''t fill with adequate hemoglobin. Large red blood cells (high MCV) frequently point to vitamin B12 or folate deficiency, which impairs the final stages of red blood cell maturation, or can indicate excessive alcohol consumption, certain medications, or thyroid disorders.

Beyond diagnosing anemia, MCV patterns help clinicians understand the root cause of fatigue, weakness, or other symptoms. Normal MCV with anemia might suggest recent blood loss or chronic disease, while abnormal MCV provides specific clues about nutritional status and bone marrow function. Monitoring MCV over time also helps assess whether treatments for anemia are working effectively.

### Key Factors

- **Iron status**: Low iron leads to smaller red blood cells
- **Vitamin B12 and folate levels**: Deficiencies cause larger red blood cells
- **Alcohol consumption**: Chronic use increases MCV even without deficiency
- **Medications**: Certain drugs (methotrexate, anticonvulsants, chemotherapy) can elevate MCV
- **Thyroid function**: Hypothyroidism can increase MCV
- **Genetics**: Inherited conditions like thalassemia affect cell size', 'claude-sonnet-4-5-20250929', '904ff0f1', '2026-03-19 07:12:33.254304+00', '2026-03-19 07:12:32.716+00'),
	('6f062676-fcd7-4f01-8753-21b648f133d6', 'afd71a80-b008-4ff8-a115-30a0e4c5e45a', '# Mercury (Hg) per g. Creatinine

### What It Measures

Mercury per gram of creatinine measures the concentration of mercury in urine, adjusted for urine dilution using creatinine as a reference point. Mercury is a toxic heavy metal that can enter the body through various environmental and dietary sources, primarily seafood consumption, dental amalgam fillings, and occupational exposure. When expressed per gram of creatinine, this measurement accounts for how concentrated or dilute your urine sample is, providing a more accurate picture of mercury excretion than a simple urine mercury level alone. The body continuously works to eliminate mercury through urine and other routes, so this biomarker reflects both recent exposure and your body''s ability to excrete this metal.

### Why It Matters

Mercury toxicity can affect multiple organ systems, with the nervous system being particularly vulnerable. Chronic low-level mercury exposure may contribute to neurological symptoms, kidney dysfunction, and cardiovascular issues, though effects often depend on the form of mercury (organic vs. inorganic) and exposure duration. Monitoring urinary mercury levels is important for individuals with high fish consumption, those with occupational exposures, or people concerned about amalgam fillings. Elevated mercury levels don''t automatically indicate poisoning, but they do suggest higher body burden and may warrant investigating exposure sources and considering reduction strategies. The creatinine-adjusted measurement is especially useful because it remains relatively stable regardless of how hydrated you are when providing the sample.

### Key Factors

- **Fish and seafood consumption**: Particularly large predatory fish like tuna, swordfish, and shark that accumulate methylmercury
- **Dental amalgam fillings**: Silver fillings contain mercury that can slowly release vapor, though most people with fillings show levels within normal ranges
- **Occupational exposure**: Jobs involving mining, manufacturing, dental work, or handling of mercury-containing products
- **Environmental exposure**: Contaminated water, air pollution near industrial sites, or broken thermometers/fluorescent bulbs
- **Individual detoxification capacity**: Genetic variations and nutritional status can affect how efficiently your body eliminates mercury', 'claude-sonnet-4-5-20250929', '4a8a9976', '2026-03-19 07:12:58.387456+00', '2026-03-19 07:12:58.09+00'),
	('0e385865-4062-4ad6-9e3a-7b62e0887788', '1b21c217-6d40-4628-83fb-1bfda2ad969a', '# Molybdenum (Mo)

### What It Measures

Molybdenum is an essential trace mineral that your body requires in very small amounts for critical enzymatic functions. Blood molybdenum levels measure the circulating concentration of this element, which reflects both your dietary intake and your body''s ability to absorb and utilize it. In the body, molybdenum doesn''t work alone—it''s incorporated into a group of enzymes called molybdoenzymes that contain a special molybdenum cofactor. These enzymes are essential for breaking down certain amino acids (the building blocks of proteins), processing sulfur-containing compounds, and metabolizing purines, which are components of DNA and RNA. The measurement in blood provides a snapshot of your current molybdenum status, though it can fluctuate based on recent dietary intake.

### Why It Matters

Molybdenum plays an indispensable role in detoxification and metabolism. The molybdoenzymes that depend on this mineral help your body process sulfites (preservatives found in foods and produced during metabolism), break down certain amino acids, and produce uric acid from purines. Without adequate molybdenum, toxic metabolites can accumulate, particularly sulfites, which some people are sensitive to. While molybdenum deficiency is extremely rare in healthy people eating varied diets, it can occur in individuals receiving long-term intravenous nutrition or those with certain genetic disorders affecting molybdenum metabolism. Conversely, excessive molybdenum—though uncommon from diet alone—can interfere with copper absorption and metabolism, potentially leading to copper deficiency symptoms. Optimal molybdenum levels support proper metabolism, help prevent the buildup of toxic compounds, and ensure that your body can efficiently process proteins and genetic material.

### Key Factors

- **Dietary intake**: Legumes, whole grains, nuts, leafy vegetables, and organ meats are primary sources
- **Soil content**: Geographic variation in soil molybdenum affects food concentrations
- **Copper interaction**: High molybdenum can reduce copper absorption and vice versa
- **Parenteral nutrition**: Long-term IV feeding may not provide adequate molybdenum
- **Genetic conditions**: Rare disorders affecting molybdenum cofactor synthesis dramatically impact levels', 'claude-sonnet-4-5-20250929', 'd5692231', '2026-03-19 07:13:25.104226+00', '2026-03-19 07:13:24.725+00'),
	('7ca4e86c-8ef2-45a6-bfed-d658900c4bea', 'b113d56f-95a6-4da0-a83b-d13b563ac83c', '# MCHC (Mean Corpuscular Hemoglobin Concentration)

## What It Measures

MCHC measures the average concentration of hemoglobin inside your red blood cells. Think of it as how "densely packed" the hemoglobin molecules are within each cell. Unlike other red blood cell measurements that look at size or total hemoglobin amount, MCHC specifically examines the ratio of hemoglobin weight to the volume of the cell itself, expressed in grams per deciliter.

This calculation reveals whether your red blood cells are properly saturated with hemoglobin—the oxygen-carrying protein that gives blood its red color. Your bone marrow produces red blood cells with a fairly consistent hemoglobin concentration under normal conditions, making MCHC one of the most tightly regulated values in hematology.

## Why It Matters

MCHC helps distinguish between different types of anemia and blood disorders. When MCHC is elevated (hyperchromic), it often indicates hereditary spherocytosis or severe dehydration, though truly elevated MCHC is relatively uncommon. Low MCHC (hypochromic) suggests that red blood cells aren''t filling properly with hemoglobin during production, most commonly seen in iron deficiency anemia or thalassemia.

Clinicians often use MCHC alongside MCV (cell size) and MCH (hemoglobin amount per cell) to identify patterns. For example, small, pale cells with low MCHC point toward iron deficiency, while normal MCHC with small cells might suggest thalassemia trait. Because MCHC values remain remarkably stable in healthy individuals, significant changes warrant investigation into iron status, chronic disease, or inherited blood conditions.

## Key Factors

- **Iron availability**: Insufficient iron prevents adequate hemoglobin synthesis, lowering MCHC
- **Chronic inflammation or disease**: Can impair iron utilization even when stores are adequate
- **Thalassemia trait**: Genetic hemoglobin disorders affect hemoglobin concentration patterns
- **Sample quality**: Specimen clotting or delayed processing can artificially affect results
- **Severe dehydration**: May temporarily elevate MCHC by concentrating red blood cells', 'claude-sonnet-4-5-20250929', '2545fc59', '2026-03-19 07:12:21.015139+00', '2026-03-19 07:12:20.398+00'),
	('fc7badb9-935c-4b7d-8842-f199e28bd4d7', '7de5e8e5-6acd-45ea-8aaa-b4acee3f6593', '# Mercury (Hg) in Urine

### What It Measures

Urinary mercury primarily measures inorganic mercury exposure and the body''s excretion of methylmercury, an organic form of mercury found predominantly in fish and seafood. When you consume methylmercury from dietary sources or are exposed to elemental mercury (from dental amalgams, broken thermometers, or occupational settings), your body processes and eliminates it through urine and feces. This test captures the mercury that your kidneys are actively filtering from your bloodstream, providing a snapshot of recent exposure—typically reflecting exposures from the past few days to weeks. Unlike blood mercury tests that show current circulating levels, urine mercury is particularly useful for assessing inorganic mercury exposure and monitoring detoxification capacity over time.

### Why It Matters

Mercury is a toxic heavy metal with no known biological function in the human body. Even low-level chronic exposure can potentially affect neurological function, kidney health, and immune system performance. The kidneys are especially vulnerable to mercury toxicity because they concentrate and excrete mercury, making them a primary target organ. Elevated urinary mercury levels may indicate excessive dietary intake of contaminated fish, environmental exposure, or occupational hazards. While the body naturally eliminates mercury, accumulation can occur when exposure exceeds excretion capacity. Optimal levels are as low as reasonably achievable, reflecting minimal environmental exposure and efficient detoxification. Monitoring this biomarker helps identify exposure sources before symptomatic toxicity develops and allows for timely intervention through dietary modifications or environmental changes.

### Key Factors

- **Fish and seafood consumption**: Large predatory fish (tuna, swordfish, shark) contain higher methylmercury levels
- **Dental amalgam fillings**: Silver fillings contain elemental mercury that can be released through chewing
- **Occupational exposure**: Mining, manufacturing, dental work, and laboratory settings may increase exposure
- **Environmental sources**: Contaminated water, air pollution near industrial sites, or broken mercury-containing devices
- **Kidney function**: Impaired kidney function affects mercury excretion efficiency', 'claude-sonnet-4-5-20250929', '7940b8df', '2026-03-19 07:12:46.086107+00', '2026-03-19 07:12:45.803+00'),
	('16ccaa10-67df-44e6-8e20-6acd09c62ebe', '2db007bb-0435-46bc-8e93-1b1a78d8bc0c', '# Manganese (Mn)

## What It Measures

Manganese is an essential trace mineral that plays a critical role in numerous enzymatic reactions throughout your body. Blood manganese levels reflect the amount of this mineral circulating in your system at the time of testing. As a cofactor for several important enzymes, manganese is integral to metabolism, bone formation, antioxidant defense, and proper nervous system function. The body maintains tight control over manganese levels through regulated absorption in the intestines and excretion primarily through bile, making blood levels a useful indicator of manganese status and potential toxicity.

Unlike some nutrients stored in large quantities, the body contains only small amounts of manganese—approximately 10-20 milligrams total—distributed across the liver, pancreas, bones, and brain. Blood measurements capture manganese bound to proteins as it travels between tissues, providing a snapshot of current exposure and metabolism rather than long-term storage.

## Why It Matters

Maintaining appropriate manganese levels is essential for health, though both deficiency and excess can cause problems. Adequate manganese supports the formation of connective tissue and bones, aids in calcium absorption, helps regulate blood sugar, and contributes to the metabolism of carbohydrates and fats. Perhaps most importantly, manganese is necessary for the production of manganese superoxide dismutase (MnSOD), a powerful antioxidant enzyme that protects cells from oxidative damage.

Manganese deficiency is rare in typical diets but can impair bone development, wound healing, and glucose metabolism. More concerning is manganese toxicity, which primarily affects the nervous system and can cause symptoms resembling Parkinson''s disease, including tremors, muscle rigidity, and difficulty with balance and coordination. Occupational exposure through welding fumes or mining dust is a well-known risk, but excessive supplementation or liver disease (which impairs manganese excretion) can also elevate levels dangerously.

## Key Factors

- **Dietary intake**: Whole grains, nuts, leafy vegetables, tea, and legumes are primary sources
- **Occupational exposure**: Welding, mining, and battery manufacturing can increase inhalation exposure
- **Liver function**: Impaired bile excretion can cause manganese accumulation
- **Supplementation**: Multivitamins and individual supplements may contribute to intake
- **Iron status**: Iron deficiency can increase manganese absorption from the gut', 'claude-sonnet-4-5-20250929', 'eb6833cb', '2026-03-19 07:13:12.191155+00', '2026-03-19 07:13:11.926+00'),
	('bdbad396-b783-421c-9d35-2ffb7eaeb1c1', 'a9d4c9f0-b7ef-434e-a3e1-3dd745bab025', '# Ni, Total (s)

### What It Measures

Total nickel (Ni) is a trace metal that can be measured in serum or other body fluids, though the "(s)" designation and the unit "μg/g Cre" (micrograms per gram of creatinine) suggests this is measured in urine and normalized to creatinine concentration. This test quantifies the total amount of nickel your body is excreting, which reflects recent exposure to this metal from environmental, occupational, or dietary sources. Nickel is not an essential nutrient for humans in meaningful amounts, so detectable levels primarily indicate external exposure rather than a necessary biological function. The body typically absorbs only a small percentage of ingested nickel, and what does enter the bloodstream is usually filtered by the kidneys and eliminated in urine within days.

### Why It Matters

Monitoring nickel levels is important for people with known or suspected nickel exposure, particularly those working in industries involving metal processing, electroplating, battery manufacturing, or welding. Excessive nickel exposure can lead to dermatological reactions (nickel is one of the most common causes of contact dermatitis), respiratory issues when inhaled, and in extreme cases, more serious systemic toxicity. Low-level dietary exposure through foods like nuts, chocolate, and certain grains is normal and typically harmless, but elevated urinary nickel may indicate problematic environmental or occupational exposure. For individuals with nickel allergies, even moderate exposures can trigger immune responses. Tracking nickel levels over time can help assess whether exposure reduction strategies are working or if workplace safety measures need adjustment.

### Key Factors

- **Occupational exposure**: Metalworking, jewelry making, electroplating, and manufacturing jobs significantly increase nickel contact
- **Dietary intake**: Consumption of nickel-rich foods like cocoa, nuts, legumes, and whole grains elevates normal background levels
- **Smoking**: Tobacco products contain nickel, and smoking substantially increases internal exposure
- **Contaminated water**: Drinking water from certain pipes or in industrial areas may contain elevated nickel
- **Timing of sample collection**: Urinary nickel levels fluctuate based on recent exposure, with peak excretion occurring 24-48 hours after contact', 'claude-sonnet-4-5-20250929', 'fb3a14d9', '2026-03-19 07:13:39.205214+00', '2026-03-19 07:13:38.598+00'),
	('94dd3293-cddb-46cb-86a6-7d7cf9842a16', '5c465e40-b488-4f92-9a74-a5de2e07836f', '# Non-HDL-Cholesterol

## What It Measures

Non-HDL cholesterol represents all the cholesterol carried by lipoproteins that are considered potentially harmful to cardiovascular health. It''s calculated by subtracting HDL cholesterol (the "good" cholesterol) from your total cholesterol, leaving behind a comprehensive measure of all the atherogenic—or artery-clogging—particles in your blood. This includes LDL cholesterol, VLDL cholesterol, and other remnant lipoproteins that can deposit cholesterol into artery walls.

Unlike LDL cholesterol alone, non-HDL cholesterol captures the full spectrum of cholesterol-carrying particles that contribute to plaque buildup in arteries. This makes it particularly valuable because some people have normal LDL levels but elevated levels of other problematic lipoproteins that non-HDL cholesterol would detect.

## Why It Matters

Non-HDL cholesterol is increasingly recognized as one of the best predictors of cardiovascular disease risk, often outperforming LDL cholesterol in research studies. Elevated levels indicate a higher burden of atherogenic particles circulating in your bloodstream, which over time can lead to atherosclerosis—the gradual narrowing and hardening of arteries that underlies heart attacks and strokes.

This biomarker is especially useful for assessing risk in people with high triglycerides or metabolic conditions like diabetes, where traditional LDL measurements may underestimate cardiovascular risk. Optimal non-HDL levels suggest your body is effectively managing cholesterol transport and clearance, reducing the likelihood of arterial damage. Many clinical guidelines now use non-HDL cholesterol as a primary treatment target because it requires no fasting and provides a more complete picture of atherogenic risk.

## Key Factors

- **Dietary saturated and trans fats**: Increase production and reduce clearance of atherogenic lipoproteins
- **Body weight and abdominal fat**: Excess weight, particularly visceral fat, elevates non-HDL cholesterol
- **Physical activity**: Regular exercise improves cholesterol profiles by enhancing lipoprotein metabolism
- **Genetic factors**: Familial hypercholesterolemia and other inherited conditions significantly raise levels
- **Metabolic health**: Insulin resistance, diabetes, and metabolic syndrome increase non-HDL cholesterol
- **Medications**: Statins, fibrates, and other lipid-lowering drugs can substantially reduce levels', 'claude-sonnet-4-5-20250929', '3b8f7c7e', '2026-03-19 07:13:51.334415+00', '2026-03-19 07:13:51.057+00'),
	('7e9bf1a0-6cff-416d-85fe-325295d2c21f', '78a0ed05-34b3-45b1-88b7-86d0273dfd27', '# Lead (Pb) - Blood Lead Level

### What It Measures

Lead is a toxic heavy metal that has no beneficial role in human biology. Blood lead testing measures the concentration of elemental lead circulating in your bloodstream, providing a snapshot of recent exposure (typically within the past 1-3 months). When lead enters your body—through ingestion, inhalation, or rarely skin absorption—it rapidly distributes into soft tissues and blood before eventually accumulating in bones and teeth, where it can remain for years or even decades. The blood lead level reflects both recent exposure and, to some extent, the mobilization of lead from bone stores, making it the primary biomarker for assessing lead toxicity and exposure risk.

Unlike essential minerals like iron or zinc, even minute amounts of lead can interfere with normal cellular processes. Lead mimics other metals in the body, particularly calcium, allowing it to cross biological barriers and disrupt enzyme systems, cellular signaling, and protein function throughout multiple organ systems.

### Why It Matters

Lead is a potent neurotoxin with no known safe threshold, particularly dangerous for developing nervous systems in children and fetuses. In adults, chronic low-level exposure can contribute to hypertension, kidney dysfunction, reproductive issues, and cognitive decline. Lead interferes with hemoglobin synthesis, potentially causing anemia, and affects calcium metabolism, which can impact bone health and cardiovascular function. The cardiovascular effects are particularly significant—elevated lead levels have been linked to increased risk of heart disease and stroke, even at levels once considered "acceptable."

There is no biological benefit to having any detectable lead in your system; optimal health corresponds with the lowest measurable levels. Modern environmental regulations have dramatically reduced lead exposure from gasoline and paint in many countries, but exposure still occurs through contaminated water (aging pipes), certain occupations (construction, battery manufacturing), imported products, contaminated soil, and some traditional remedies or cosmetics.

### Key Factors

- **Occupational exposure**: Construction work, battery manufacturing, welding, firing ranges, ceramics, and metal recycling
- **Environmental sources**: Lead paint in homes built before 1978, contaminated drinking water from lead pipes or fixtures, contaminated soil
- **Dietary factors**: Calcium, iron, and vitamin C deficiency can increase lead absorption from the gut
- **Bone turnover**: Pregnancy, lactation, menopause, and osteoporosis can mobilize stored lead from bones into blood
- **Imported products**: Certain traditional medicines, cosmetics, pottery, and food products from countries with less stringent regulations', 'claude-sonnet-4-5-20250929', '51ca347d', '2026-03-19 07:14:20.736174+00', '2026-03-19 07:14:20.458+00'),
	('1a57e361-6f9e-459b-990d-ec1e2ccc9dfa', '183533e4-a28c-4741-b46c-328aaeb1f1c2', '# Platelets

### What It Measures

Platelets, also called thrombocytes, are tiny cell fragments that circulate in your bloodstream and play a critical role in blood clotting. Unlike red and white blood cells, platelets aren''t complete cells—they''re fragments produced by large bone marrow cells called megakaryocytes. When measured in a Complete Blood Count, the platelet count indicates how many of these clotting particles are present per microliter of blood. These microscopic disc-shaped fragments constantly patrol your circulatory system, ready to spring into action whenever a blood vessel is damaged. They form the initial plug at injury sites and release chemical signals that trigger the coagulation cascade, the body''s complex clotting mechanism.

### Why It Matters

Platelet counts are essential for maintaining the delicate balance between bleeding and clotting. Too few platelets (thrombocytopenia) can lead to excessive bleeding, easy bruising, prolonged bleeding from minor cuts, or in severe cases, spontaneous internal bleeding. This can occur due to bone marrow disorders, autoimmune conditions, certain medications, or other health issues. Conversely, elevated platelet counts (thrombocytosis) may increase the risk of inappropriate blood clot formation, potentially leading to stroke, heart attack, or clots in the legs or lungs. High platelets can be reactive (responding to inflammation, infection, or iron deficiency) or primary (from bone marrow disorders). Optimal platelet levels ensure your body can effectively stop bleeding when needed while avoiding dangerous clot formation in intact blood vessels—a crucial aspect of cardiovascular and overall health.

### Key Factors

- **Medications**: Aspirin, anticoagulants, chemotherapy, and certain antibiotics can lower platelet counts
- **Inflammation and infection**: Acute illnesses often cause temporary platelet elevations as part of the immune response
- **Iron deficiency**: Can paradoxically increase platelet production, sometimes significantly
- **Bone marrow health**: Conditions affecting bone marrow directly impact platelet production
- **Spleen function**: An enlarged spleen can trap and sequester platelets, lowering blood counts
- **Alcohol consumption**: Chronic use can suppress bone marrow and reduce platelet production', 'claude-sonnet-4-5-20250929', 'dbc745ba', '2026-03-19 07:14:47.02898+00', '2026-03-19 07:14:46.706+00'),
	('e2da8116-8234-4b2e-82e9-3724eaac7658', '9db5003c-a571-4d2e-871a-0729b3c0f769', '# Progesterone

### What It Measures

Progesterone is a steroid hormone produced primarily by the ovaries after ovulation, with smaller amounts made by the adrenal glands. In females, the corpus luteum (the follicle remnant after an egg is released) becomes the main source of progesterone during the second half of the menstrual cycle. If pregnancy occurs, the placenta takes over as the primary producer. In males, progesterone is produced in much smaller quantities by the adrenal glands and serves as a precursor for other hormones like testosterone and cortisol.

This hormone plays a crucial role in preparing the uterine lining for potential pregnancy and maintaining early pregnancy. Blood tests measure the circulating level of progesterone, which fluctuates dramatically throughout the menstrual cycle in females, rising sharply after ovulation and falling if pregnancy doesn''t occur.

### Why It Matters

Progesterone levels provide important information about reproductive health and ovulation status. In females trying to conceive, progesterone testing can confirm whether ovulation has occurred—levels rise significantly (typically above 3 ng/mL) only after an egg has been released. Low levels during the luteal phase may indicate ovulation problems or insufficient corpus luteum function, which can affect fertility. During pregnancy, progesterone levels should rise progressively; inadequate levels may be associated with miscarriage risk or ectopic pregnancy.

Beyond fertility, progesterone influences mood, sleep quality, bone health, and cardiovascular function. It has calming effects on the nervous system and works in balance with estrogen to regulate numerous physiological processes. Abnormal levels can contribute to menstrual irregularities, premenstrual symptoms, and mood disturbances. In perimenopausal and menopausal women, declining progesterone (often before estrogen falls) can cause symptoms and may be assessed when considering hormone therapy.

### Key Factors

- **Menstrual cycle timing**: Levels are 10-20 times higher during the luteal phase (after ovulation) than the follicular phase
- **Pregnancy status**: Progesterone rises dramatically during pregnancy, reaching levels 10-100 times higher than non-pregnant levels
- **Hormonal contraceptives**: Birth control pills, IUDs, and implants can significantly alter progesterone levels
- **Stress and cortisol production**: Chronic stress can affect progesterone synthesis since both share common hormone precursors
- **Age and reproductive stage**: Levels decline with perimenopause and drop significantly after menopause', 'claude-sonnet-4-5-20250929', '5f80e8e9', '2026-03-19 07:15:12.030298+00', '2026-03-19 07:15:11.771+00'),
	('9c56d5b0-3f5a-455d-8a6a-b28dbb3df900', '016384aa-b73c-48c9-9a6e-55e865028cc8', '# PSA (Prostate-Specific Antigen)

## What It Measures

Prostate-specific antigen (PSA) is a protein produced primarily by cells in the prostate gland, a small walnut-sized organ located below the bladder in males. While small amounts of PSA normally enter the bloodstream, elevated levels can indicate changes in prostate tissue. PSA exists in the blood in both bound (attached to other proteins) and free forms, with total PSA representing the combined measurement of both.

The prostate naturally produces PSA as part of seminal fluid, where it helps liquefy semen after ejaculation. When prostate tissue is disrupted—whether by benign enlargement, inflammation, or cellular changes—more PSA leaks into the bloodstream, raising detectable levels in blood tests.

## Why It Matters

PSA testing serves as an important screening tool for prostate health, though it''s not specific to any single condition. Elevated PSA can indicate benign prostatic hyperplasia (BPH), prostatitis (inflammation), or prostate cancer, which is why PSA alone cannot diagnose cancer—it signals the need for further evaluation. Rising PSA levels over time (PSA velocity) or a low ratio of free-to-total PSA may warrant additional investigation through digital rectal examination, imaging, or biopsy.

Normal PSA levels tend to increase gradually with age as the prostate naturally enlarges. What''s considered "elevated" depends on age, prostate size, and individual risk factors. While PSA screening has been controversial due to potential overdiagnosis and overtreatment of slow-growing cancers, it remains valuable for detecting aggressive prostate cancers early when treatment is most effective. The key is shared decision-making about testing based on individual risk factors, age, and preferences.

## Key Factors

- **Age and prostate size**: PSA naturally increases as the prostate enlarges with age
- **Recent sexual activity or ejaculation**: Can temporarily elevate PSA for 24-48 hours
- **Prostate manipulation**: Cycling, digital rectal exams, or catheterization may cause short-term increases
- **Urinary tract infections or prostatitis**: Inflammation significantly raises PSA levels
- **Medications**: 5-alpha reductase inhibitors (finasteride, dutasteride) can reduce PSA by approximately 50%', 'claude-sonnet-4-5-20250929', '6f5adb1f', '2026-03-19 07:15:39.355944+00', '2026-03-19 07:15:39.055+00'),
	('7a9bae40-536d-480f-9c2d-5fbc9b2ecfc5', '480507b1-0207-4d84-83f2-6ca428562f79', '# Oxidized LDL (ox-LDL)

## What It Measures

Oxidized LDL (ox-LDL) measures the amount of low-density lipoprotein cholesterol that has undergone oxidative damage in your bloodstream. While standard LDL cholesterol tests measure the total quantity of LDL particles, ox-LDL specifically identifies LDL that has been chemically modified by free radicals and reactive oxygen species. This oxidation process transforms normal LDL into a more harmful form that your body''s immune system recognizes as foreign or damaged.

The oxidation of LDL particles typically occurs when they remain in circulation too long or when they penetrate the arterial wall, where they''re exposed to oxidative stress. This modified form of cholesterol is particularly relevant because it represents LDL that has crossed the threshold from a simple transport molecule into an actively harmful substance that triggers inflammatory responses.

## Why It Matters

Ox-LDL is considered a superior predictor of cardiovascular disease risk compared to standard LDL cholesterol measurements. When LDL becomes oxidized, it''s much more likely to be taken up by macrophages in arterial walls, forming foam cells—the building blocks of atherosclerotic plaques. This process initiates and perpetuates the inflammatory cascade that leads to arterial narrowing, plaque instability, and ultimately heart attacks or strokes.

Elevated ox-LDL levels indicate not just the presence of cholesterol, but active oxidative stress and vascular inflammation—the mechanisms that actually drive cardiovascular disease progression. This makes it a valuable marker for assessing true cardiovascular risk, particularly in people whose standard lipid panels appear normal but who may still be at significant risk. Lower levels of ox-LDL suggest better antioxidant protection and less active arterial damage, even if total LDL cholesterol is moderately elevated.

## Key Factors

- **Antioxidant status**: Low intake of vitamins C, E, and polyphenols increases oxidation susceptibility
- **Inflammation levels**: Chronic inflammatory conditions accelerate LDL oxidation
- **Blood sugar control**: Elevated glucose and insulin resistance promote oxidative stress
- **Smoking and pollution**: Environmental toxins directly increase oxidative damage
- **LDL particle size**: Small, dense LDL particles are more prone to oxidation than large, buoyant ones', 'claude-sonnet-4-5-20250929', 'a87c6b72', '2026-03-19 07:14:04.627393+00', '2026-03-19 07:14:04.374+00'),
	('c7b11e8c-e3b9-4de9-8117-1e9d09bda73f', 'd6a11311-df16-4548-a344-6640d688d511', '# Phosphorus

### What It Measures

Phosphorus is an essential mineral that exists in your blood primarily as phosphate, a compound containing phosphorus and oxygen. This test measures the amount of inorganic phosphate circulating in your bloodstream at the time of the blood draw. Phosphorus is the second most abundant mineral in your body after calcium, with about 85% stored in your bones and teeth as part of the mineral structure that gives them strength and rigidity. The remaining 15% is distributed throughout soft tissues and bodily fluids, where it plays crucial roles in energy metabolism and cellular function.

As a key component of ATP (adenosine triphosphate), phosphorus is essential for producing and storing energy in every cell of your body. It''s also a structural element of DNA and RNA, cell membranes, and various enzymes. Your kidneys carefully regulate blood phosphorus levels by adjusting how much is absorbed from food and how much is excreted in urine, working in concert with parathyroid hormone and vitamin D to maintain balance.

### Why It Matters

Maintaining optimal phosphorus levels is critical for bone health, energy production, and proper kidney function. When phosphorus levels fall outside the normal range, it often signals problems with kidney function, parathyroid gland activity, or vitamin D metabolism. Low phosphorus (hypophosphatemia) can cause muscle weakness, bone pain, confusion, and increased fracture risk, while chronically low levels may contribute to osteomalacia (soft bones) in adults or rickets in children.

High phosphorus levels (hyperphosphatemia) are most commonly seen in people with chronic kidney disease, as failing kidneys lose their ability to excrete excess phosphorus. Elevated levels can lead to calcium-phosphorus imbalances that cause calcium deposits in soft tissues, blood vessels, and organs—a serious complication that increases cardiovascular risk. The phosphorus-calcium balance is particularly important; when one is abnormal, the other is often affected, which is why these minerals are frequently tested together.

### Key Factors

- **Kidney function**: The primary regulator of phosphorus excretion; impaired kidney function typically raises levels
- **Dietary intake**: Phosphorus-rich foods (dairy, meat, fish, nuts, beans) and phosphate additives in processed foods
- **Vitamin D status**: Increases intestinal absorption of phosphorus from food
- **Parathyroid hormone**: Decreases blood phosphorus by increasing kidney excretion
- **Medications**: Antacids, diuretics, and phosphate binders can significantly alter levels
- **Bone metabolism**: Conditions affecting bone breakdown or formation influence phosphorus release', 'claude-sonnet-4-5-20250929', '69679400', '2026-03-19 07:14:35.153916+00', '2026-03-19 07:14:34.85+00'),
	('50eb2554-c8a9-464f-8369-7551eecebcf9', '6bc7cc4c-3ff2-4ed1-bce7-b95fe3364c60', '# Potassium

### What It Measures

Potassium is an essential electrolyte that carries a positive electrical charge and plays a crucial role in cellular function throughout your body. This test measures the concentration of potassium dissolved in your blood serum. At the cellular level, potassium is primarily found inside cells, where it works in concert with sodium to maintain electrical gradients across cell membranes. This electrical balance is fundamental to how cells communicate and function.

Your body tightly regulates blood potassium levels within a narrow range because even small deviations can have significant effects. The kidneys are the primary regulators, adjusting how much potassium is excreted in urine based on dietary intake and bodily needs. Potassium moves constantly between your bloodstream and cells, influenced by hormones like insulin and aldosterone, as well as your body''s acid-base balance.

### Why It Matters

Potassium is absolutely critical for three major body systems: your heart''s electrical activity, muscle contraction, and nerve signal transmission. In the heart, potassium helps maintain the regular rhythm of your heartbeat by controlling the electrical signals that coordinate each contraction. Abnormal potassium levels can cause dangerous heart rhythm disturbances, which is why this biomarker is closely monitored in many clinical situations.

Your muscles—including the diaphragm you use to breathe—depend on proper potassium levels to contract and relax normally. Too much or too little potassium can cause muscle weakness, cramps, or in severe cases, paralysis. Potassium also affects how your kidneys concentrate urine and how your digestive system moves food along. Optimal potassium levels support cardiovascular health, help regulate blood pressure, and may reduce the risk of kidney stones and bone loss over time.

### Key Factors

- **Dietary intake**: Foods rich in potassium (bananas, potatoes, spinach, beans) or very low-potassium diets directly affect blood levels
- **Kidney function**: Impaired kidney function reduces potassium excretion, while certain kidney conditions increase losses
- **Medications**: Diuretics, ACE inhibitors, NSAIDs, and potassium supplements can significantly alter levels
- **Dehydration or fluid loss**: Vomiting, diarrhea, or excessive sweating can deplete potassium stores
- **Hormonal factors**: Aldosterone, insulin, and conditions affecting these hormones influence potassium distribution between blood and cells', 'claude-sonnet-4-5-20250929', 'b6fa1623', '2026-03-19 07:14:59.156063+00', '2026-03-19 07:14:58.892+00'),
	('4be71bba-3e97-4ecd-aede-61e2c192fc01', '9e979e68-51a5-4153-a14c-a060a78db4d1', '# Prolactin

### What It Measures

Prolactin is a hormone produced primarily by the pituitary gland, a pea-sized structure at the base of your brain that serves as the body''s hormonal control center. While prolactin is best known for its role in lactation—stimulating breast milk production after childbirth—it actually serves multiple functions throughout life in both women and men. The hormone influences reproductive health, metabolism, immune function, and fluid balance. In non-pregnant, non-breastfeeding individuals, prolactin typically circulates at relatively low baseline levels, with natural fluctuations occurring throughout the day and in response to various stimuli including stress, sleep, and physical activity.

### Why It Matters

Prolactin levels provide important insights into pituitary function and reproductive health. Elevated prolactin (hyperprolactinemia) can suppress the reproductive hormones that regulate menstrual cycles in women and testosterone production in men, potentially leading to irregular periods, fertility challenges, decreased libido, and in men, erectile dysfunction. High prolactin may result from pituitary tumors (usually benign), certain medications (particularly some psychiatric and blood pressure drugs), thyroid disorders, or chronic stress. Conversely, abnormally low prolactin is rare but may indicate pituitary dysfunction. Even moderate elevations can affect bone density over time by indirectly reducing sex hormone production. Because prolactin interacts closely with other hormones in the endocrine system, monitoring it helps assess the overall hormonal balance that governs reproductive health, metabolism, and well-being.

### Key Factors

- **Medications**: Antipsychotics, antidepressants, blood pressure medications, and opioids can significantly raise prolactin levels
- **Stress and sleep**: Prolactin rises during sleep, exercise, and physical or emotional stress; testing should ideally occur in a relaxed, fasting state
- **Reproductive status**: Pregnancy and breastfeeding naturally cause substantial prolactin elevation
- **Thyroid function**: Hypothyroidism (underactive thyroid) can trigger increased prolactin production
- **Timing of test**: Levels vary throughout the day, typically higher in early morning and during sleep', 'claude-sonnet-4-5-20250929', '8b0c9ed6', '2026-03-19 07:15:26.289684+00', '2026-03-19 07:15:25.307+00'),
	('8c23e6e5-a46d-43cb-82cf-17d4741f2f6e', '3bc05e6c-da6b-4e86-87e6-6a60c3e05574', '# Lead (Pb)

## What It Measures

Lead is a heavy metal that has no biological function in the human body. When measured in blood, lead levels indicate recent or ongoing exposure to this toxic element. The body does not use or need lead for any physiological process—any detectable amount represents environmental contamination. Blood lead measurements reflect exposure from the past few weeks to months, as lead circulates in blood before being stored in bones and soft tissues or eliminated through urine and feces. This biomarker serves as a critical screening tool for environmental and occupational health surveillance.

## Why It Matters

Lead is a potent neurotoxin that can damage multiple organ systems, even at low levels. In children, lead exposure impairs brain development, affecting learning, behavior, and IQ. In adults, chronic exposure increases risks of hypertension, kidney disease, and reproductive problems. Lead interferes with heme synthesis (important for oxygen-carrying red blood cells), disrupts calcium metabolism, and damages nerve cells. While severe lead poisoning is less common today due to regulations removing lead from gasoline and paint, low-level chronic exposure remains a public health concern. Early detection through blood testing allows for intervention before irreversible damage occurs. Elevated levels require identifying and eliminating exposure sources.

## Key Factors

- **Old housing**: Pre-1978 homes may contain lead-based paint that deteriorates into dust
- **Occupational exposure**: Jobs in battery manufacturing, construction, welding, or metal recycling
- **Water supply**: Older plumbing with lead pipes or lead solder, especially in acidic water systems
- **Hobbies**: Stained glass work, pottery with lead glazes, ammunition reloading, or home renovation
- **Imported products**: Certain cosmetics, spices, candies, or traditional medicines from countries with less regulation
- **Soil contamination**: Living near former industrial sites, smelters, or high-traffic roadways', 'claude-sonnet-4-5-20250929', '31762fd9', '2026-03-19 07:15:53.940729+00', '2026-03-19 07:15:53.571+00'),
	('820e74dc-3363-44f8-9aca-386a13c4b284', '3a33d3a0-a1b6-48fe-832e-737a98e1eb68', '# Red Blood Cells (RBC)

### What It Measures

Red blood cells, also known as erythrocytes, are the most abundant cells in your bloodstream, making up approximately 40-45% of your blood volume. These specialized cells are produced in your bone marrow and have a distinctive biconcave disc shape that maximizes their surface area for their primary function: transporting oxygen from your lungs to every tissue in your body and carrying carbon dioxide back to be exhaled. Each red blood cell is packed with hemoglobin, an iron-containing protein that binds to oxygen molecules and gives blood its red color. The RBC count measures the total number of these cells per microliter of blood, providing insight into your body''s oxygen-carrying capacity.

A typical red blood cell lives for approximately 120 days before being filtered out by the spleen and liver, with your bone marrow continuously producing millions of new cells each second to maintain a steady supply. This constant production and turnover process is tightly regulated by erythropoietin, a hormone primarily produced by your kidneys that signals your bone marrow to increase or decrease red blood cell production based on your body''s oxygen needs.

### Why It Matters

Your RBC count directly impacts how efficiently your body delivers oxygen to vital organs, muscles, and tissues. When red blood cell counts are too low (anemia), you may experience fatigue, weakness, shortness of breath, dizziness, and pale skin because your tissues aren''t receiving adequate oxygen. Conversely, when counts are too high (polycythemia), your blood becomes thicker and flows less efficiently, potentially increasing the risk of blood clots, stroke, and heart complications.

The RBC count is often one of the first indicators of underlying health issues ranging from nutritional deficiencies and chronic diseases to bone marrow disorders and genetic conditions. It works in concert with other blood parameters like hemoglobin and hematocrit to paint a complete picture of your blood''s oxygen-carrying capacity. Optimal RBC levels support energy production, cognitive function, exercise performance, immune health, and overall vitality—essentially enabling every cell in your body to function at its best.

### Key Factors

- **Nutritional status**: Iron, vitamin B12, folate, and copper are essential for red blood cell production
- **Altitude and oxygen exposure**: Living at high altitudes or chronic low oxygen states stimulate increased RBC production
- **Hydration status**: Dehydration can artificially concentrate red blood cells, while overhydration can dilute them
- **Physical activity**: Regular endurance exercise can increase RBC production over time; excessive training may temporarily decrease counts
- **Chronic diseases**: Kidney disease, inflammatory conditions, and autoimmune disorders can suppress red blood cell production
- **Medications**: Certain drugs including chemotherapy agents, antibiotics, and anti-seizure medications may affect RBC counts', 'claude-sonnet-4-5-20250929', '72fbbd63', '2026-03-19 07:16:21.765562+00', '2026-03-19 07:16:21.405+00'),
	('45642592-4eda-4938-9722-9fe03aaa585c', '19bdab1d-6478-4e27-9250-d053dc67520e', '# Red Cell Distribution Width (RDW)

## What It Measures

Red Cell Distribution Width (RDW) measures the variation in size among your red blood cells. Think of it as a quality control metric for your blood cells—it tells us whether your red blood cells are relatively uniform in size or show significant variation. When your bone marrow produces red blood cells efficiently, they tend to be consistent in size. The RDW calculates the coefficient of variation, expressing how much individual red blood cell volumes deviate from the average.

This measurement becomes particularly valuable when interpreted alongside other red blood cell parameters like hemoglobin and mean corpuscular volume (MCV). A normal RDW indicates your red blood cells are homogeneous, while an elevated RDW suggests a mixed population of cells with different sizes—a condition called anisocytosis.

## Why It Matters

RDW serves as an important diagnostic clue for distinguishing between different types of anemia and other blood disorders. When red blood cells vary significantly in size, it often indicates your body is experiencing some form of stress or deficiency affecting blood cell production. For example, iron deficiency anemia typically shows elevated RDW as your body struggles to produce properly sized cells, while thalassemia trait (a genetic condition) usually maintains normal RDW despite low MCV.

Beyond anemia diagnosis, emerging research has linked elevated RDW to inflammation, nutritional deficiencies, and even cardiovascular risk. A higher RDW can reflect chronic inflammation, oxidative stress, or poor nutritional status—all factors that disrupt the bone marrow''s ability to produce uniform, healthy red blood cells. This makes RDW increasingly valuable as a general health marker, though it''s never interpreted in isolation.

## Key Factors

- **Nutritional deficiencies**: Iron, vitamin B12, or folate deficiency can cause increased variation in cell size
- **Bone marrow function**: Conditions affecting bone marrow production efficiency influence red blood cell uniformity
- **Chronic inflammation**: Ongoing inflammatory processes can disrupt normal red blood cell production
- **Recent blood loss or transfusion**: These create mixed populations of old and new cells with different sizes
- **Hemolytic conditions**: Accelerated red blood cell destruction followed by regeneration increases size variation', 'claude-sonnet-4-5-20250929', 'c16f88fb', '2026-03-19 07:16:06.505572+00', '2026-03-19 07:16:06.116+00'),
	('3eaec984-9e81-4ed3-8b83-ccaf12f909b2', '165df636-561f-484c-909b-6e38b296f93b', '# Selenium

### What It Measures

Selenium is an essential trace mineral that your body needs in small amounts but cannot produce on its own. A selenium blood test measures the concentration of this mineral in your serum, reflecting both your recent dietary intake and your body''s selenium stores. Selenium is incorporated into specialized proteins called selenoproteins, which function throughout your body as powerful antioxidants and regulators of thyroid hormone metabolism. The selenium level in your blood provides a snapshot of your nutritional status for this mineral, though it''s worth noting that blood selenium levels can fluctuate based on recent dietary changes, while tissue stores may take longer to deplete or replenish.

### Why It Matters

Selenium plays critical roles in immune function, thyroid health, DNA synthesis, and protection against oxidative stress and infection. Your thyroid gland has the highest concentration of selenium in the body, as it''s essential for converting the thyroid hormone T4 into its active form, T3. Adequate selenium levels support a robust immune response and may help reduce inflammation throughout the body. Deficiency can lead to weakened immunity, thyroid dysfunction, increased susceptibility to certain diseases, and in severe cases, specific conditions like Keshan disease (a heart disorder) or Kashin-Beck disease (affecting joints and bones). On the other hand, excessive selenium intake can cause toxicity, resulting in symptoms like hair loss, nail brittleness, nausea, and neurological issues. Maintaining optimal selenium levels supports antioxidant defense systems, cardiovascular health, and may play a role in cancer prevention and cognitive function.

### Key Factors

- **Geographic location and soil content**: Selenium content in foods depends on soil selenium levels, which vary dramatically by region
- **Dietary intake**: Primary sources include Brazil nuts, seafood, organ meats, whole grains, and eggs
- **Supplementation**: Selenium supplements or multivitamins can significantly impact blood levels
- **Thyroid disorders**: Both hypothyroidism and hyperthyroidism can affect selenium metabolism
- **Digestive health**: Conditions affecting nutrient absorption (like Crohn''s disease or celiac disease) may reduce selenium uptake', 'claude-sonnet-4-5-20250929', 'c7334b0f', '2026-03-19 07:16:33.501362+00', '2026-03-19 07:16:33.231+00'),
	('5e2c5ded-ad7d-4e3d-88e0-366ee7df4181', '0b68518d-f31d-4586-b13c-3b7f9d90c833', '# Sex Hormone Binding Globulin (SHBG)

## What It Measures

Sex Hormone Binding Globulin (SHBG) is a protein produced primarily by the liver that acts as a transport carrier for sex hormones in your bloodstream. Think of it as a molecular taxi service—SHBG binds to testosterone, estrogen, and other sex hormones, controlling how much of these hormones are "free" and biologically active in your body. When hormones are bound to SHBG, they''re essentially in storage, unable to interact with tissues. Only the unbound, or "free," portion of hormones can enter cells and exert biological effects.

The level of SHBG in your blood directly influences your hormonal balance by regulating the availability of active sex hormones. Higher SHBG levels mean more hormones are bound up and less are free to work in your tissues. Lower SHBG levels mean more free, active hormones circulating. This makes SHBG a critical factor in understanding your true hormonal status, as total hormone measurements alone don''t tell the complete story.

## Why It Matters

SHBG levels provide insight into hormonal balance, metabolic health, and liver function. In men, low SHBG is often associated with insulin resistance, metabolic syndrome, type 2 diabetes, and obesity—conditions that can suppress SHBG production. Low SHBG in men can paradoxically lead to symptoms of low testosterone despite normal total testosterone levels, because more of the hormone is being cleared from circulation.

In women, SHBG levels help evaluate conditions like polycystic ovary syndrome (PCOS), where low SHBG contributes to elevated free testosterone and associated symptoms like irregular periods and hirsutism. High SHBG can occur with hyperthyroidism, certain liver conditions, or estrogen-containing medications, potentially reducing the availability of active sex hormones and contributing to symptoms like low libido or fatigue. Optimal SHBG levels support balanced hormonal activity and generally correlate with better metabolic health and lower cardiovascular risk.

## Key Factors

- **Insulin sensitivity**: Insulin resistance and high insulin levels suppress SHBG production
- **Body composition**: Higher body fat, especially visceral fat, is associated with lower SHBG
- **Thyroid function**: Hyperthyroidism raises SHBG, while hypothyroidism lowers it
- **Medications**: Oral estrogen, birth control pills, and some thyroid medications increase SHBG; androgens and corticosteroids decrease it
- **Liver health**: Since SHBG is produced by the liver, liver function directly affects levels', 'claude-sonnet-4-5-20250929', 'ae59981', '2026-03-19 07:16:49.569162+00', '2026-03-19 07:16:49.288+00'),
	('b86faab6-1156-4270-b8f9-212d5c691d5f', '4c517970-d387-4deb-ad17-88f048898f30', '# Sodium

### What It Measures

Sodium is the primary electrolyte found in the fluid surrounding your cells (extracellular fluid) and makes up the majority of your blood''s electrical charge carriers. This mineral plays a fundamental role in regulating the volume of fluid in your body, maintaining blood pressure, and controlling the balance between water inside and outside your cells. When you get a sodium test, it''s measuring the concentration of sodium dissolved in your blood plasma, which reflects your body''s overall sodium-to-water ratio rather than just how much sodium you''ve consumed. Your kidneys are the master controllers here, constantly adjusting how much sodium they retain or excrete based on signals from hormones like aldosterone and antidiuretic hormone (ADH).

The sodium level in your blood is kept within a remarkably tight range through an intricate feedback system involving your kidneys, brain, and endocrine system. Even small deviations from this range can significantly affect how your cells function, since sodium gradients across cell membranes are essential for nerve impulses, muscle contractions, and the transport of other nutrients into cells.

### Why It Matters

Maintaining proper sodium balance is critical for neurological function and cardiovascular health. When sodium levels drift outside the optimal range, it affects your cells'' ability to maintain proper fluid balance, which can lead to swelling or dehydration at the cellular level. The brain is particularly sensitive to sodium changes—both high and low sodium can cause confusion, fatigue, seizures, or in severe cases, life-threatening complications.

Abnormal sodium levels often signal underlying issues with kidney function, hormonal imbalances, heart failure, liver disease, or medication effects rather than simply indicating too much or too little dietary salt. For example, low sodium (hyponatremia) is often caused by excess water retention rather than sodium deficiency, while high sodium (hypernatremia) typically indicates dehydration or impaired thirst mechanisms. Because sodium is so tightly regulated, persistent abnormalities warrant medical investigation to identify the root cause.

### Key Factors

- **Hydration status**: Dehydration concentrates sodium, while excessive water intake dilutes it
- **Medications**: Diuretics, antidepressants (SSRIs), and some blood pressure medications significantly affect sodium levels
- **Kidney function**: The kidneys are the primary regulators of sodium balance, so kidney disease disrupts sodium homeostasis
- **Hormonal conditions**: Adrenal disorders, thyroid problems, and syndrome of inappropriate ADH (SIADH) all impact sodium regulation
- **Heart and liver health**: Chronic heart failure and cirrhosis can cause sodium retention and dilution through complex compensatory mechanisms', 'claude-sonnet-4-5-20250929', '8980bce8', '2026-03-19 07:17:03.806818+00', '2026-03-19 07:17:03.165+00'),
	('944c365a-b8d5-4fce-a640-3f5f1fe024c4', 'a908e197-5c9e-4aa5-9a76-a8a38a0b9c2f', '# T3 (Triiodothyronine)

## What It Measures

T3, or triiodothyronine, is one of the two primary hormones produced by your thyroid gland, a butterfly-shaped organ at the base of your neck. While the thyroid produces mostly T4 (thyroxine), T3 is actually the more biologically active form—it''s approximately four times more potent than T4 in triggering cellular responses. Most T3 in your bloodstream doesn''t come directly from the thyroid; instead, it''s created when tissues throughout your body convert T4 into T3 by removing one iodine atom. This blood test measures the free (unbound) T3 circulating in your system.

T3 acts as a metabolic accelerator for nearly every cell in your body. It binds to receptors inside cells and influences gene expression, controlling how quickly your cells burn energy, produce heat, and carry out their specialized functions. From your heart rate and digestive speed to brain function and body temperature, T3 orchestrates the pace of your body''s operations.

## Why It Matters

T3 levels provide crucial insight into thyroid function and metabolic health, particularly when T4 levels alone don''t explain symptoms. In hyperthyroidism, excessive T3 can accelerate metabolism beyond healthy levels, causing rapid heartbeat, anxiety, weight loss, heat intolerance, and tremors. Some people develop a condition called T3 toxicosis, where T3 is disproportionately elevated even when T4 is normal. Conversely, low T3 can indicate hypothyroidism or poor T4-to-T3 conversion, potentially causing fatigue, weight gain, cold sensitivity, brain fog, and depression.

T3 testing is especially valuable for monitoring certain thyroid conditions and evaluating treatment effectiveness. It helps identify issues with peripheral hormone conversion—some people produce adequate T4 but struggle to convert it to active T3, a phenomenon sometimes called "low T3 syndrome." This can occur with chronic illness, stress, certain medications, or nutritional deficiencies. Optimal T3 levels support healthy energy production, cognitive function, cardiovascular health, and metabolic efficiency.

## Key Factors

- **Thyroid medications**: Levothyroxine affects T4 levels, which influences T3; liothyronine directly provides T3
- **Nutritional status**: Selenium, zinc, and iron are essential for converting T4 to T3
- **Chronic stress or illness**: Can suppress T3 production as an adaptive mechanism to conserve energy
- **Caloric restriction**: Prolonged low-calorie diets can reduce T3 conversion to slow metabolism
- **Certain medications**: Beta-blockers, corticosteroids, and some other drugs can impair T4-to-T3 conversion', 'claude-sonnet-4-5-20250929', 'f5a038da', '2026-03-19 07:17:18.399359+00', '2026-03-19 07:17:18.118+00'),
	('59e58a4e-5a26-497b-9d2f-d50aa79e4d5f', '69ba9187-b336-48c8-9eac-bdb7a189b322', '# T4 (Thyroxine)

## What It Measures

T4, or thyroxine, is the primary hormone produced by your thyroid gland, a butterfly-shaped organ located at the base of your neck. The thyroid manufactures T4 by combining iodine (obtained from your diet) with the amino acid tyrosine. This biomarker measures the total amount of T4 circulating in your bloodstream, including both the portion bound to carrier proteins and the small fraction that remains unbound (free T4).

T4 serves as a storage form of thyroid hormone and acts as a precursor to T3 (triiodothyronine), the more metabolically active thyroid hormone. Your body''s tissues convert T4 to T3 as needed, making T4 an essential component of your endocrine system''s regulatory mechanisms. The production of T4 is controlled by a feedback loop involving the pituitary gland and hypothalamus, which respond to circulating thyroid hormone levels.

## Why It Matters

T4 plays a crucial role in regulating your body''s metabolism, affecting nearly every organ system. Adequate T4 levels are essential for maintaining energy production, body temperature, heart rate, digestive function, muscle control, brain development, and bone health. When T4 levels fall outside the optimal range, it can significantly impact your overall well-being.

Low T4 levels (hypothyroidism) may result in fatigue, weight gain, cold sensitivity, dry skin, hair loss, constipation, and cognitive difficulties. Elevated T4 levels (hyperthyroidism) can cause anxiety, weight loss, heat intolerance, rapid heartbeat, tremors, and sleep disturbances. Because T4 levels reflect your thyroid gland''s function, measuring this biomarker helps healthcare providers assess thyroid health and metabolic status. It''s particularly important for monitoring thyroid replacement therapy and detecting thyroid disorders early.

## Key Factors

- **Thyroid medications**: Levothyroxine supplementation directly increases T4 levels, while antithyroid medications reduce production
- **Iodine intake**: Both deficiency and excess iodine can affect T4 production
- **Protein levels**: Changes in binding proteins (due to pregnancy, birth control pills, or liver disease) can alter total T4 without affecting thyroid function
- **Stress and illness**: Acute or chronic illness can temporarily suppress T4 production
- **Time of day**: T4 levels show minimal daily variation, unlike TSH, making testing time less critical', 'claude-sonnet-4-5-20250929', '99c6b1aa', '2026-03-19 07:17:31.545885+00', '2026-03-19 07:17:31.252+00'),
	('1e734d20-25c9-4b5a-a14f-5711ac47e692', '8b2e3954-b08a-422c-87e5-ffbd4eaaa58f', '# Testosterone

### What It Measures

Testosterone is the primary androgen (male sex hormone) produced mainly in the testes in men and in smaller amounts in the ovaries and adrenal glands in women. This steroid hormone circulates through the bloodstream in three forms: tightly bound to sex hormone-binding globulin (SHBG), loosely bound to albumin, and free (unbound). A standard testosterone test typically measures total testosterone—the sum of all three forms. This hormone serves as a crucial signaling molecule that influences cellular activity throughout the body, with effects extending far beyond reproductive function to include muscle development, bone density, fat distribution, and even cognitive processes.

### Why It Matters

Testosterone plays vital roles in both men and women, though at vastly different concentrations. In men, adequate testosterone supports muscle mass and strength, bone density, red blood cell production, sperm development, libido, and mood stability. Low testosterone (hypogonadism) can result from testicular disorders, pituitary dysfunction, or natural age-related decline, potentially leading to fatigue, reduced muscle mass, decreased bone density, mood changes, and sexual dysfunction. Abnormally high levels may indicate certain tumors or exogenous hormone use.

In women, testosterone contributes to bone strength, muscle maintenance, and sexual well-being. Elevated levels may signal polycystic ovary syndrome (PCOS), adrenal disorders, or ovarian tumors, potentially causing irregular periods, excess hair growth, acne, and metabolic issues. Low levels in women can contribute to decreased energy and sexual desire. Because testosterone levels significantly impact metabolic health, cardiovascular risk, and quality of life across genders, monitoring this hormone provides valuable insight into endocrine function and overall physiological balance.

### Key Factors

- **Age**: Levels naturally decline after age 30-40 in men (about 1% per year); women experience drops during menopause
- **Time of day**: Peaks in early morning (7-10 AM), lowest in evening—consistent timing is essential for accurate tracking
- **Body composition**: Excess body fat, particularly abdominal fat, tends to lower testosterone through increased aromatase activity
- **Medications**: Opioids, corticosteroids, and certain psychiatric medications can suppress levels; anabolic steroids artificially elevate them
- **Exercise**: Resistance training can boost levels, while chronic overtraining may suppress them', 'claude-sonnet-4-5-20250929', 'fc96003f', '2026-03-19 07:17:48.731101+00', '2026-03-19 07:17:48.379+00'),
	('aa9655e9-3a1d-4d74-a3d1-ef95a9fc4048', 'dfa1976d-d5fb-4edf-89d8-65ec5a08d24f', '# Total Iron Binding Capacity (TIBC)

## What It Measures

Total Iron Binding Capacity measures the maximum amount of iron that your blood can carry using a protein called transferrin. Think of transferrin as a fleet of trucks that transport iron throughout your body, and TIBC tells you how many trucks are available for the job. This test doesn''t measure how much iron is actually in your blood (that''s a different test), but rather your blood''s total capacity to bind and transport iron if it were fully loaded.

When you eat iron-rich foods, your body absorbs the iron through your intestines and loads it onto transferrin molecules made by your liver. These iron-loaded transferrin molecules then travel through your bloodstream, delivering iron to bone marrow for red blood cell production, muscles for myoglobin synthesis, and various tissues that need iron for cellular energy production and enzyme function.

## Why It Matters

TIBC is particularly valuable for diagnosing different types of anemia and understanding iron metabolism disorders. When your body senses low iron stores, your liver produces more transferrin, increasing TIBC—essentially sending out more empty trucks hoping to pick up scarce iron. This elevation commonly occurs in iron deficiency anemia. Conversely, in conditions where there''s plenty of iron but inflammation prevents its proper use (like chronic disease anemia), TIBC typically decreases because the body doesn''t need extra transport capacity.

The relationship between TIBC and other iron markers creates a diagnostic picture. High TIBC with low serum iron suggests iron deficiency, while low TIBC with high or normal iron might indicate iron overload conditions, chronic inflammation, or liver disease (since the liver produces transferrin). This biomarker helps clinicians distinguish between different causes of anemia and guides appropriate treatment—whether that''s iron supplementation, addressing inflammation, or managing iron excess.

## Key Factors

- **Iron intake and stores**: Low dietary iron or depleted body iron increases TIBC as your body tries to capture more iron
- **Inflammation and chronic disease**: Inflammatory conditions typically decrease TIBC as part of the body''s defense mechanism
- **Liver function**: Since transferrin is made in the liver, liver disease can reduce TIBC production
- **Pregnancy**: TIBC often increases during pregnancy due to increased iron demands for fetal development
- **Malnutrition and protein status**: Severe protein deficiency can lower TIBC since transferrin is a protein', 'claude-sonnet-4-5-20250929', 'cb32b787', '2026-03-19 07:18:15.224429+00', '2026-03-19 07:18:14.945+00'),
	('4354f316-836d-43cf-ab08-52a8ef8df122', '432a7bcc-c736-4bce-960d-19e68d6a15fe', '# Total Cholesterol

### What It Measures

Total cholesterol is a measurement of all the cholesterol circulating in your bloodstream at the time of testing. Cholesterol is a waxy, fat-like substance that''s essential for life—your body uses it to build cell membranes, produce hormones (including testosterone, estrogen, and cortisol), synthesize vitamin D, and create bile acids that help digest fats. Your liver produces about 75% of your body''s cholesterol, while the remaining 25% comes from dietary sources.

This measurement combines several types of cholesterol-carrying particles: low-density lipoprotein (LDL), high-density lipoprotein (HDL), and very-low-density lipoprotein (VLDL). Each of these lipoproteins serves as a transport vehicle, carrying cholesterol and other fats through your water-based bloodstream to where they''re needed throughout your body.

### Why It Matters

Total cholesterol serves as an initial screening tool for cardiovascular health and metabolic function. While it doesn''t tell the complete story on its own, persistently elevated total cholesterol often signals an imbalance in how your body produces, uses, or clears cholesterol from circulation. This can increase the risk of cholesterol deposits forming in artery walls, potentially leading to atherosclerosis, heart disease, and stroke over time.

However, total cholesterol must be interpreted in context with its components—particularly the ratio of LDL to HDL cholesterol. You can have a higher total cholesterol but still maintain healthy cardiovascular risk if much of that comes from protective HDL cholesterol. Conversely, even borderline total cholesterol can be concerning if most comes from LDL particles. Optimal total cholesterol levels generally reflect efficient lipid metabolism, healthy liver function, and balanced hormone production.

### Key Factors

- **Diet composition**: Saturated fat, trans fat, and dietary cholesterol intake influence production and clearance
- **Genetics**: Familial hypercholesterolemia and other genetic variations significantly affect baseline cholesterol levels
- **Physical activity**: Regular exercise typically increases HDL and improves overall cholesterol balance
- **Body weight**: Excess body fat, particularly visceral fat, often raises total cholesterol and shifts ratios unfavorably
- **Medications**: Statins, bile acid sequestrants, and certain other drugs directly lower cholesterol levels', 'claude-sonnet-4-5-20250929', '74823046', '2026-03-19 07:18:40.283132+00', '2026-03-19 07:18:40.011+00'),
	('22d4f7ac-674f-4ef2-b0b7-0bd200084875', '829a92af-7069-44a2-a79a-e01c2f7abb2c', '# Triglycerides

### What It Measures

Triglycerides are the most common type of fat found in your blood and body. Chemically, they''re molecules made of three fatty acid chains attached to a glycerol backbone—hence "tri-glyceride." Your body creates triglycerides from excess calories, particularly from carbohydrates and fats that you consume but don''t immediately need for energy. When you eat, your body converts calories it doesn''t need right away into triglycerides, which are then stored in fat cells. Between meals, hormones trigger the release of these triglycerides to provide energy throughout the day.

Measuring blood triglycerides tells you how much of this fat is circulating in your bloodstream at a given time. While some triglycerides are normal and necessary for energy storage and cellular function, elevated levels indicate your body is either producing too much fat, not clearing it efficiently from the blood, or both.

### Why It Matters

Triglyceride levels are a key indicator of metabolic and cardiovascular health. Chronically elevated triglycerides contribute to atherosclerosis—the hardening and narrowing of arteries—which increases risk for heart attack, stroke, and peripheral artery disease. Very high triglycerides (above 500 mg/dL) can also cause acute pancreatitis, a serious inflammatory condition of the pancreas.

High triglycerides often cluster with other metabolic problems, including insulin resistance, low HDL ("good") cholesterol, high blood pressure, and excess abdominal fat—collectively known as metabolic syndrome. This pattern dramatically increases cardiovascular disease risk. Conversely, optimal triglyceride levels reflect good metabolic function: your body efficiently processes dietary fats and carbohydrates, maintains insulin sensitivity, and clears fat particles from the bloodstream effectively.

### Key Factors

- **Diet composition**: High intake of refined carbohydrates, sugar, and alcohol particularly elevate triglycerides; excess calories from any source contribute
- **Physical activity**: Regular exercise lowers triglycerides by improving fat metabolism and insulin sensitivity
- **Body weight**: Excess body fat, especially visceral (abdominal) fat, is strongly associated with elevated levels
- **Insulin resistance and diabetes**: Impaired glucose metabolism leads to increased triglyceride production
- **Timing of test**: Triglycerides rise significantly after eating; fasting 9-12 hours before testing provides the most accurate baseline measurement
- **Genetics**: Some people have hereditary conditions causing very high triglycerides regardless of lifestyle factors', 'claude-sonnet-4-5-20250929', 'ef8366a1', '2026-03-19 07:19:06.889402+00', '2026-03-19 07:19:06.319+00'),
	('85fdc885-7bc5-458e-8b0f-f1545a92194c', 'c26c416c-0143-4a94-b94e-28ab0735119f', '# Thyroid Peroxidase Antibodies (TPO-Ab)

## What It Measures

Thyroid Peroxidase Antibodies (TPO-Ab) are proteins produced by your immune system that mistakenly target thyroid peroxidase, an essential enzyme in your thyroid gland. Thyroid peroxidase plays a crucial role in producing thyroid hormones by helping convert iodine into a form that can be incorporated into these hormones. When your body produces antibodies against this enzyme, it signals that your immune system has identified your thyroid tissue as foreign, leading to an autoimmune response.

The presence and level of these antibodies indicate whether your immune system is actively attacking your thyroid gland. Unlike markers that measure thyroid function directly (like TSH or thyroid hormones), TPO-Ab reveals the underlying cause of thyroid dysfunction when autoimmunity is involved.

## Why It Matters

Elevated TPO-Ab levels are the hallmark of autoimmune thyroid diseases, particularly Hashimoto''s thyroiditis (which causes hypothyroidism) and, less commonly, Graves'' disease (which causes hyperthyroidism). Hashimoto''s is one of the most common autoimmune conditions, affecting up to 5% of the population, with women being significantly more affected than men.

Detecting these antibodies is clinically valuable because it helps distinguish autoimmune thyroid disease from other causes of thyroid dysfunction, guides treatment decisions, and can predict future thyroid problems. People with elevated TPO-Ab may have normal thyroid function initially but face increased risk of developing hypothyroidism over time. The presence of these antibodies is also associated with other autoimmune conditions, pregnancy complications, and can affect fertility. Monitoring TPO-Ab levels helps healthcare providers understand disease progression and adjust thyroid hormone replacement therapy as needed.

## Key Factors

- **Genetics and family history**: Autoimmune thyroid disease runs in families, with genetic predisposition playing a significant role
- **Sex and hormones**: Women are 5-10 times more likely to develop thyroid autoimmunity; pregnancy and menopause can trigger or worsen antibody production
- **Other autoimmune conditions**: Presence of type 1 diabetes, celiac disease, rheumatoid arthritis, or lupus increases likelihood of thyroid antibodies
- **Iodine intake**: Both excessive and insufficient iodine can trigger autoimmune thyroid responses in susceptible individuals
- **Environmental triggers**: Infections, stress, smoking, and certain medications may activate or intensify autoimmune thyroid processes', 'claude-sonnet-4-5-20250929', 'a4c25a72', '2026-03-19 07:18:01.475999+00', '2026-03-19 07:18:01.207+00'),
	('13ce7f01-7fd8-4ccf-bad0-9c4b5f717b16', '78e117bc-228b-41a1-8cdf-1f92a913bbd7', '# Thallium (Tl)

## What It Measures

Thallium is a soft, highly toxic heavy metal that occurs naturally in the earth''s crust but has no known biological function in the human body. When measured in blood, thallium testing detects exposure to this element, which can enter the body through contaminated food, water, air, or occupational contact. The test quantifies circulating thallium levels in micrograms per liter (μg/L), providing a snapshot of recent or ongoing exposure. Unlike essential minerals that the body actively regulates, thallium is purely a contaminant—its presence at any detectable level indicates environmental or occupational exposure rather than a deficiency or excess of something the body needs.

## Why It Matters

Thallium toxicity, though rare, is a serious medical concern because this metal interferes with cellular energy production and protein synthesis throughout the body. Historically used in rat poisons and now found in some industrial processes, cement production, electronics manufacturing, and coal combustion emissions, thallium can accumulate in tissues and cause damage to the nervous system, gastrointestinal tract, cardiovascular system, and hair follicles. Even low-level chronic exposure may lead to peripheral neuropathy, hair loss, gastrointestinal disturbances, and cognitive effects. Monitoring thallium levels is particularly important for individuals working in high-risk industries, those living near industrial sites or hazardous waste facilities, and anyone with unexplained neurological symptoms that might suggest heavy metal poisoning. Early detection through blood testing allows for timely intervention and removal from the exposure source.

## Key Factors

- **Occupational exposure**: Electronics manufacturing, glass production, cement plants, and semiconductor industries
- **Environmental contamination**: Living near coal-burning plants, smelters, or hazardous waste sites
- **Contaminated food or water**: Particularly in areas with industrial pollution or naturally high thallium in soil
- **Smoking**: Tobacco plants can accumulate thallium from soil, leading to exposure through cigarette smoke
- **Timing of test**: Blood levels peak within hours of acute exposure but may remain elevated for days to weeks depending on exposure magnitude', 'claude-sonnet-4-5-20250929', 'ea4e8f25', '2026-03-19 07:18:28.113767+00', '2026-03-19 07:18:27.852+00'),
	('48f21c19-f629-4336-9eee-681163aebddc', 'da237a49-9617-43d5-9e7a-eb2397d51930', '# Transferrin Saturation

### What It Measures

Transferrin saturation measures the percentage of transferrin—your blood''s primary iron transport protein—that is actually carrying iron molecules. Think of transferrin as a fleet of delivery trucks circulating through your bloodstream, and transferrin saturation tells you what percentage of those trucks are loaded with cargo. This biomarker is calculated by dividing serum iron by total iron-binding capacity (TIBC) and multiplying by 100. It provides a snapshot of how much iron is available in your circulation relative to your body''s capacity to transport it, making it one of the most sensitive indicators of iron status.

### Why It Matters

Transferrin saturation is crucial for diagnosing and distinguishing between different types of iron disorders. Low transferrin saturation (typically below 20%) suggests iron deficiency, meaning your body doesn''t have enough iron available to meet its needs—particularly for producing hemoglobin in red blood cells. This can lead to iron deficiency anemia, causing fatigue, weakness, and impaired cognitive function. Conversely, elevated transferrin saturation (above 45-50%) may indicate iron overload conditions such as hereditary hemochromatosis, where excess iron accumulates in organs and can cause liver damage, heart problems, and diabetes if left untreated.

This biomarker is especially valuable because it responds quickly to changes in iron availability, making it useful for monitoring iron supplementation effectiveness or detecting early iron depletion before anemia develops. It also helps clinicians differentiate between true iron deficiency and anemia of chronic disease, where inflammation affects iron metabolism differently.

### Key Factors

- **Dietary iron intake**: Both heme iron (from meat) and non-heme iron (from plants) influence levels, with absorption varying by source
- **Inflammatory conditions**: Acute or chronic inflammation can decrease transferrin saturation by sequestering iron, even when total body stores are adequate
- **Menstrual cycle and pregnancy**: Regular blood loss or increased iron demands can lower saturation
- **Time of day**: Iron levels fluctuate diurnally, with higher values typically in the morning
- **Recent iron supplementation**: Can temporarily elevate readings within hours of consumption
- **Genetic factors**: Hereditary hemochromatosis mutations (especially HFE gene) can cause persistently elevated saturation', 'claude-sonnet-4-5-20250929', 'a3bfa4d', '2026-03-19 07:18:52.413689+00', '2026-03-19 07:18:52.116+00'),
	('8601ee27-e7a8-4495-9d5c-8853be354f4f', '21d8f34c-7136-45bc-a14b-5324eb054f0f', '# Troponin I

### What It Measures

Troponin I is a specialized protein found exclusively in the heart muscle (cardiac tissue). It''s part of the troponin complex that regulates the contraction and relaxation of heart muscle cells. Under normal circumstances, troponin I remains tightly bound within heart muscle fibers and appears in the bloodstream at only trace levels, if at all. When heart muscle cells are damaged or die—such as during a heart attack—they release troponin I into the bloodstream, where it can be detected through blood testing. The amount released correlates with the extent of cardiac muscle injury, making it one of the most specific and sensitive markers available for detecting heart muscle damage.

### Why It Matters

Troponin I is the gold standard biomarker for diagnosing acute myocardial infarction (heart attack). Elevated levels indicate that heart muscle cells have been damaged, which typically occurs when blood flow to part of the heart is blocked. Because troponin I is found almost exclusively in heart tissue, it offers superior specificity compared to older cardiac markers—it''s rarely elevated by anything other than cardiac injury. Levels begin rising within 3-4 hours of heart muscle damage, peak at 12-24 hours, and can remain elevated for up to two weeks. This makes it invaluable not only for diagnosing heart attacks but also for assessing the extent of damage and monitoring recovery. Even small elevations can indicate cardiac stress or minor injury from conditions like myocarditis, severe heart failure, or prolonged extreme exercise. In optimal health, troponin I should be undetectable or present only at extremely low levels.

### Key Factors

- **Acute coronary events**: Blocked coronary arteries causing heart attacks produce the most significant elevations
- **Heart inflammation**: Myocarditis or pericarditis can cause moderate increases without arterial blockage
- **Kidney function**: Severe kidney disease can lead to mildly elevated troponin levels due to reduced clearance
- **Extreme physical exertion**: Marathon running or intense endurance exercise may cause temporary, minor elevations
- **Other cardiac conditions**: Heart failure, rapid heart rhythms, or cardiac trauma can release troponin into circulation', 'claude-sonnet-4-5-20250929', 'a456e31c', '2026-03-19 07:19:19.275741+00', '2026-03-19 07:19:19.002+00'),
	('9d4a4167-ba07-4443-a183-6564bc6bb90e', '1e8ad3b0-69d9-4d44-bf59-ec222dd278db', '# TSH (Thyroid Stimulating Hormone)

## What It Measures

Thyroid Stimulating Hormone (TSH) is produced by your pituitary gland, a small but powerful gland at the base of your brain. Think of TSH as your body''s thermostat for thyroid function—it tells your thyroid gland how much thyroid hormone to produce. When your thyroid hormone levels drop, your pituitary releases more TSH to signal the thyroid to increase production. Conversely, when thyroid hormone levels are adequate or high, TSH production decreases. This feedback loop is how your body maintains metabolic balance.

TSH doesn''t measure thyroid hormones directly, but rather the pituitary''s assessment of whether your body needs more or less thyroid hormone. This makes it an incredibly sensitive marker for detecting thyroid dysfunction, often showing abnormalities before thyroid hormones themselves appear out of range.

## Why It Matters

TSH is typically the first and most important test for evaluating thyroid function because it reflects the overall communication between your brain and thyroid gland. Elevated TSH usually indicates hypothyroidism (underactive thyroid), where your pituitary is working overtime trying to stimulate a sluggish thyroid. This can lead to symptoms like fatigue, weight gain, cold intolerance, and brain fog. Low TSH generally suggests hyperthyroidism (overactive thyroid), where excessive thyroid hormone production suppresses the pituitary''s need to stimulate further, potentially causing anxiety, weight loss, rapid heartbeat, and heat intolerance.

Optimal TSH levels support healthy metabolism, energy production, body temperature regulation, heart function, and cognitive performance. Because thyroid hormones affect virtually every cell in your body, maintaining proper TSH balance is crucial for overall wellbeing and quality of life.

## Key Factors

- **Medications**: Thyroid replacement therapy, biotin supplements, steroids, and certain psychiatric medications can significantly affect TSH levels
- **Time of day**: TSH naturally peaks during nighttime hours and is lowest in the afternoon
- **Stress and illness**: Acute illness, major surgery, or severe stress can temporarily suppress TSH
- **Age**: TSH tends to increase slightly with age, and optimal ranges may shift in older adults
- **Pregnancy**: TSH requirements change dramatically during pregnancy, with lower targets typically needed in the first trimester', 'claude-sonnet-4-5-20250929', 'fcfd5d1f', '2026-03-19 07:19:31.864245+00', '2026-03-19 07:19:31.573+00'),
	('86c18324-ba4e-413a-ac10-9b8c1c9d13e5', '2ba306b3-8e3f-4592-93ca-233b37c9385c', '# UIBC (Unsaturated Iron Binding Capacity)

## What It Measures

UIBC measures the reserve capacity of transferrin, the protein responsible for transporting iron through your bloodstream. Think of transferrin as a fleet of delivery trucks: some are already carrying iron (measured as serum iron), while others are empty and ready to pick up more cargo. UIBC specifically measures how many of these "trucks" are currently empty and available to bind iron.

When combined with serum iron levels, UIBC helps calculate your Total Iron Binding Capacity (TIBC) and transferrin saturation percentage, providing a comprehensive picture of how your body manages iron transport and storage. This test is particularly valuable because it reveals not just how much iron you have, but how efficiently your body can move it where it''s needed.

## Why It Matters

UIBC is a critical marker for diagnosing and monitoring various iron-related disorders. In iron deficiency, your body produces more transferrin in an attempt to capture whatever iron is available, resulting in elevated UIBC—lots of empty trucks searching for cargo. Conversely, when iron stores are excessive (as in hemochromatosis or iron overload), UIBC typically decreases because most transferrin molecules are already saturated with iron.

Beyond iron disorders, UIBC can reflect overall health status. It may be elevated in pregnancy (when iron demands increase) or decreased in chronic inflammatory conditions, liver disease, or malnutrition where transferrin production is impaired. Abnormal UIBC values often prompt further investigation into anemia, fatigue, or unexplained symptoms. Understanding your iron transport capacity is essential because both iron deficiency and excess can have serious health consequences, from anemia and fatigue to organ damage.

## Key Factors

- **Iron intake and stores**: Dietary iron deficiency drives UIBC up; iron overload drives it down
- **Inflammation and infection**: Acute or chronic inflammation can suppress transferrin production, lowering UIBC
- **Liver function**: Since transferrin is made in the liver, liver disease reduces UIBC
- **Hormonal changes**: Pregnancy and oral contraceptives typically increase UIBC
- **Nutritional status**: Protein malnutrition impairs transferrin synthesis, decreasing UIBC', 'claude-sonnet-4-5-20250929', '4ccee78d', '2026-03-19 07:19:58.595152+00', '2026-03-19 07:19:58.311+00'),
	('caa722f0-6c93-4302-9373-432d9bb41433', '42a14841-da5a-4740-a412-08c7e8f7f0eb', '# Uranium (U)

## What It Measures

Uranium is a naturally occurring radioactive heavy metal found in soil, rock, and water throughout the environment. When measured in biological samples, urinary uranium testing quantifies recent exposure to this element, typically expressed as a ratio to creatinine to account for urine concentration variability. The body does not use uranium for any biological function—it''s purely an environmental contaminant that enters through drinking water, food grown in uranium-rich soil, or occupational exposure in mining, military, or nuclear industries.

Most uranium absorbed into the body is rapidly filtered by the kidneys and excreted in urine within days, making urinary uranium an effective marker of recent exposure rather than long-term body burden. The kidneys themselves become the primary target organ for uranium toxicity, as they concentrate the metal during filtration.

## Why It Matters

While uranium exposure from natural environmental sources is typically low and poses minimal health risk to most people, elevated levels can indicate problematic exposure that warrants investigation. The primary health concern with uranium is its chemical toxicity to the kidneys rather than its radioactivity at environmental exposure levels. Chronic elevated exposure can impair kidney function, potentially causing tubular damage and affecting the kidney''s ability to filter waste effectively.

Certain populations face higher exposure risk: those using private wells in uranium-rich geological areas, workers in phosphate fertilizer plants or uranium processing facilities, and military personnel exposed to depleted uranium munitions. Monitoring uranium levels helps identify exposure sources that can be mitigated, such as contaminated drinking water that may require filtration or alternative water sources.

## Key Factors

- **Drinking water source**: Private wells in areas with uranium-rich geology (granite, phosphate deposits) are the most common source of elevated exposure
- **Geographic location**: Residential proximity to uranium mining operations, phosphate processing plants, or contaminated groundwater sites
- **Occupational exposure**: Employment in nuclear facilities, uranium mining, military operations, or phosphate fertilizer production
- **Dietary intake**: Consumption of root vegetables, shellfish, or grains grown in uranium-contaminated soil
- **Timing of sample**: Reflects exposure over the past few days due to rapid kidney elimination', 'claude-sonnet-4-5-20250929', 'f6799e04', '2026-03-19 07:19:45.874732+00', '2026-03-19 07:19:45.599+00'),
	('2a77964a-2578-4286-9e5d-945c7bbffb5d', '19caacbd-21f8-419c-8d8e-9e382350f66d', '# Vitamin A

### What It Measures

Vitamin A refers to a group of fat-soluble compounds, primarily retinol and its derivatives, that circulate in your bloodstream bound to specific carrier proteins. When you get a vitamin A blood test, laboratories typically measure retinol concentration, which represents the vitamin''s storage and transport form in your body. This biomarker reflects both your recent dietary intake of vitamin A (from animal sources like liver, dairy, and eggs) and provitamin A carotenoids (from colorful vegetables like carrots and sweet potatoes), as well as your body''s ability to store this essential nutrient in the liver.

The measurement provides a snapshot of your vitamin A status, though it''s worth noting that blood levels remain relatively stable until liver stores become significantly depleted or excessive. Your body tightly regulates circulating vitamin A to maintain consistent levels for critical functions, meaning blood tests are most useful for detecting moderate to severe deficiency or toxicity rather than subtle fluctuations.

### Why It Matters

Vitamin A plays indispensable roles throughout your body, particularly in maintaining healthy vision, immune function, skin integrity, and cellular communication. It''s essential for the production of rhodopsin, a protein in your eyes that enables vision in low light conditions—which is why severe deficiency can lead to night blindness. Beyond vision, vitamin A regulates gene expression and supports the immune system''s ability to fight infections, maintains the health of mucous membranes that line your respiratory and digestive tracts, and supports reproductive health.

Deficiency is relatively rare in developed countries but can occur with malabsorption disorders, chronic liver disease, or severely restricted diets. Low levels may manifest as vision problems, increased susceptibility to infections, dry skin, and poor wound healing. Conversely, excessive vitamin A—typically from over-supplementation rather than food—can cause toxicity, leading to liver damage, bone problems, and birth defects during pregnancy. Optimal vitamin A status supports robust immune defense, healthy skin and mucous membranes, and proper cellular growth and differentiation throughout the body.

### Key Factors

- **Dietary intake**: Consumption of animal-source vitamin A (retinol) and plant-source carotenoids significantly influences levels
- **Fat absorption**: As a fat-soluble vitamin, adequate dietary fat and healthy digestive function are necessary for absorption
- **Liver health**: The liver stores 80-90% of the body''s vitamin A, so liver disease can impair storage and release
- **Zinc status**: Zinc deficiency impairs vitamin A metabolism and the release of retinol from liver stores
- **Protein status**: Retinol-binding protein (which requires adequate protein nutrition) is needed to transport vitamin A in blood
- **Alcohol consumption**: Chronic excessive alcohol intake can deplete liver vitamin A stores and impair metabolism', 'claude-sonnet-4-5-20250929', '65db2d32', '2026-03-19 07:20:30.865083+00', '2026-03-19 07:20:30.602+00'),
	('cd50ee3c-e53d-429b-a70d-f027af7a3c3c', 'f3933a85-57ad-495d-bd02-f81216189665', '# Vitamin B1 (Thiamine)

### What It Measures

Vitamin B1, also known as thiamine, is a water-soluble vitamin that plays an essential role in cellular energy production and nervous system function. This test measures the concentration of thiamine in your blood, reflecting your body''s current stores of this vital nutrient. Unlike fat-soluble vitamins that can be stored for extended periods, thiamine reserves are limited—your body maintains only about a 3-week supply. Because thiamine cannot be produced by the body, it must be obtained through diet or supplementation. The active form of this vitamin, thiamine pyrophosphate (TPP), serves as a critical coenzyme in carbohydrate metabolism, helping convert glucose into usable energy for cells throughout your body.

### Why It Matters

Thiamine is indispensable for proper brain and nerve function, heart health, and metabolic processes. Adequate levels support cognitive function, muscle coordination, and cardiovascular performance. When thiamine levels drop too low, it can lead to serious conditions like beriberi (affecting the cardiovascular and nervous systems) or Wernicke-Korsakoff syndrome (a neurological disorder). Even mild deficiency can manifest as fatigue, irritability, muscle weakness, or difficulty concentrating. Conversely, maintaining optimal thiamine levels supports efficient energy metabolism, helps the body handle stress, and promotes healthy nerve signal transmission. Certain populations face higher risk of deficiency, including those with alcohol use disorder (which impairs thiamine absorption and increases excretion), individuals with chronic digestive conditions, pregnant or breastfeeding women, and people consuming highly processed diets low in whole grains and fortified foods.

### Key Factors

- **Dietary intake**: Whole grains, legumes, nuts, pork, and fortified cereals are primary sources; refined grains lose most thiamine during processing
- **Alcohol consumption**: Chronic alcohol use significantly impairs thiamine absorption, storage, and utilization
- **Digestive health**: Conditions like Crohn''s disease, celiac disease, or chronic diarrhea reduce absorption
- **Diuretic medications**: Long-term use can increase urinary thiamine excretion
- **High carbohydrate intake**: Increased carbohydrate consumption raises thiamine requirements for metabolism', 'claude-sonnet-4-5-20250929', '698cb3a2', '2026-03-19 07:20:43.019156+00', '2026-03-19 07:20:42.729+00'),
	('60c10a00-f7e8-4e17-bbe6-eebb8555af97', '4ebcc5e1-4412-49e7-852d-c0da36e82217', '# Vitamin B12

### What It Measures

Vitamin B12, also known as cobalamin, is a water-soluble vitamin that plays essential roles in red blood cell formation, DNA synthesis, and nervous system function. This test measures the amount of B12 circulating in your blood, bound primarily to transport proteins called transcobalamin and haptocorrin. Unlike many vitamins that your body can produce, B12 must be obtained entirely from dietary sources—primarily animal products like meat, fish, eggs, and dairy—or supplements. Once consumed, B12 requires a complex absorption process in the stomach and small intestine involving intrinsic factor, a protein produced by stomach cells that binds to B12 and allows it to be absorbed in the lower intestine.

The measurement reflects both your recent dietary intake and your body''s stores, though serum B12 levels don''t always perfectly correlate with tissue stores or functional status. Your liver can store several years'' worth of B12, which means deficiency typically develops slowly over time rather than appearing suddenly.

### Why It Matters

Adequate B12 levels are critical for producing healthy red blood cells and maintaining the protective myelin sheath around nerves. When B12 is insufficient, red blood cells become abnormally large and dysfunctional, leading to megaloblastic anemia with symptoms like fatigue, weakness, and shortness of breath. Neurological complications can be even more serious, potentially causing numbness, tingling, balance problems, memory issues, and mood changes. If left untreated, nerve damage may become irreversible.

Optimal B12 status supports energy metabolism, cognitive function, and cardiovascular health by helping regulate homocysteine levels. Deficiency is particularly common in older adults (due to reduced stomach acid production), strict vegetarians and vegans, people with digestive disorders affecting absorption (like Crohn''s disease or celiac disease), and those who''ve had gastric surgery. Certain medications, particularly proton pump inhibitors and metformin, can also interfere with B12 absorption over time.

### Key Factors

- **Dietary intake**: Consumption of animal products (meat, fish, poultry, eggs, dairy) or fortified foods and supplements
- **Age**: Stomach acid production decreases with age, reducing B12 absorption capacity
- **Digestive health**: Conditions like atrophic gastritis, pernicious anemia, Crohn''s disease, or celiac disease impair absorption
- **Medications**: Long-term use of proton pump inhibitors, H2 blockers, or metformin can reduce B12 levels
- **Surgical history**: Gastric bypass or removal of parts of the stomach or intestine affects absorption
- **Alcohol consumption**: Excessive intake can interfere with B12 absorption and storage', 'claude-sonnet-4-5-20250929', 'a21a8ed6', '2026-03-19 07:20:56.570827+00', '2026-03-19 07:20:56.301+00'),
	('0f0bad28-c18d-4bce-996f-d8fba9b1e424', 'c30dc184-6d2e-4c1c-a325-b209752706e0', '# Vitamin B6

## What It Measures

Vitamin B6, measured as pyridoxal 5''-phosphate (PLP) in the blood, reflects your body''s active stores of this essential water-soluble vitamin. Unlike fat-soluble vitamins that accumulate in tissues, vitamin B6 must be regularly replenished through diet or supplementation. This biomarker captures the biologically active form of the vitamin that''s actually available for use in cellular processes. Blood levels provide a reliable snapshot of your recent intake and absorption status, though they don''t necessarily reflect tissue stores in organs like the liver or muscles.

The measurement represents a delicate balance: your body converts dietary B6 from foods (like poultry, fish, potatoes, and chickpeas) into PLP, which then circulates in the bloodstream bound to proteins. This active form serves as a cofactor—essentially a molecular assistant—for over 100 different enzymatic reactions throughout your body, making it one of the most versatile vitamins in human biochemistry.

## Why It Matters

Vitamin B6 plays a central role in amino acid metabolism, neurotransmitter synthesis, and hemoglobin production. Adequate levels support cognitive function, mood regulation, and immune system performance. The vitamin is particularly crucial for producing serotonin, dopamine, and GABA—neurotransmitters that regulate mood, sleep, and stress responses. It also helps break down homocysteine, an amino acid that, when elevated, is associated with cardiovascular risk.

Low vitamin B6 levels can manifest as fatigue, confusion, weakened immunity, or peripheral neuropathy (nerve damage causing numbness and tingling). Deficiency is relatively uncommon in healthy adults eating varied diets, but certain populations face higher risk: older adults, people with kidney disease, autoimmune conditions, or alcohol dependence. Conversely, excessively high levels—typically from over-supplementation rather than food sources—can paradoxically cause nerve damage, demonstrating that more isn''t always better with this vitamin.

## Key Factors

- **Dietary intake**: Consumption of B6-rich foods like poultry, fish, fortified cereals, bananas, and chickpeas directly influences blood levels
- **Medications**: Certain drugs including some antibiotics, anti-seizure medications, and oral contraceptives can deplete B6 or interfere with its metabolism
- **Alcohol consumption**: Regular or excessive alcohol intake impairs B6 absorption and increases its breakdown
- **Kidney function**: Compromised kidney health reduces the body''s ability to activate and retain vitamin B6
- **Inflammatory conditions**: Chronic inflammation and autoimmune diseases can increase B6 requirements and accelerate its depletion', 'claude-sonnet-4-5-20250929', '6d62fcaf', '2026-03-19 07:21:10.268258+00', '2026-03-19 07:21:10.002+00'),
	('eb69d4c6-24a9-4484-b940-539d9a5b3e90', '81f6fe68-a414-4dce-83d7-1302c118ff9f', '# Vitamin D

### What It Measures

Vitamin D is a fat-soluble hormone that your body produces when skin is exposed to ultraviolet B (UVB) rays from sunlight, though it can also be obtained through certain foods and supplements. The blood test measures 25-hydroxyvitamin D [25(OH)D], which is the main circulating form and the most accurate indicator of your body''s vitamin D status. This compound represents the combined vitamin D from all sources—sun exposure, diet, and supplements—before it''s converted into its active hormonal form (calcitriol) primarily in the kidneys.

The measurement reflects your body''s reserves of this critical nutrient over the past several weeks to months, making it a reliable biomarker for assessing whether you''re getting adequate vitamin D to support essential physiological functions throughout your body.

### Why It Matters

Vitamin D plays crucial roles far beyond its well-known function in calcium absorption and bone health. It acts as a hormone that regulates gene expression in virtually every cell type in your body, influencing immune function, cardiovascular health, muscle strength, and even mood regulation. Adequate vitamin D levels support proper bone mineralization, helping prevent conditions like osteoporosis, rickets in children, and osteomalacia in adults.

Insufficient vitamin D has been associated with increased susceptibility to infections, autoimmune conditions, and inflammatory disorders, as it modulates both innate and adaptive immune responses. Optimal levels support muscle function and may reduce fall risk in older adults. Emerging research also links vitamin D status to metabolic health, with deficiency potentially contributing to insulin resistance. Because vitamin D deficiency is remarkably common—affecting an estimated 40% of adults in many populations—monitoring this biomarker helps identify a correctable nutritional gap that can impact multiple body systems.

### Key Factors

- **Sun exposure**: Geographic location, season, time spent outdoors, skin pigmentation, and sunscreen use dramatically affect vitamin D production
- **Dietary intake**: Few foods naturally contain vitamin D (fatty fish, egg yolks, mushrooms), though many products are fortified
- **Body composition**: Vitamin D is fat-soluble and can be sequestered in adipose tissue, making obesity a risk factor for lower circulating levels
- **Age**: Skin''s ability to synthesize vitamin D decreases with age, and kidney conversion to active form becomes less efficient
- **Supplementation**: The most reliable way to maintain consistent levels, especially in winter months or for those with limited sun exposure', 'claude-sonnet-4-5-20250929', 'b035a7da', '2026-03-19 07:21:24.751196+00', '2026-03-19 07:21:24.316+00'),
	('efed9efe-1c33-40ac-89f9-51e0c0767e7b', 'a0095d05-82fa-46dc-b6f5-0e15fbed1a22', '# Vitamin E

### What It Measures

Vitamin E is a fat-soluble antioxidant that exists in eight different forms, with alpha-tocopherol being the most biologically active in humans. This biomarker measures the concentration of vitamin E circulating in your blood, primarily reflecting your dietary intake and absorption of this essential nutrient. As a fat-soluble vitamin, vitamin E is stored in adipose tissue and the liver, and requires adequate fat in the diet for proper absorption through the intestinal lining. Blood levels represent the balance between dietary intake, absorption efficiency, tissue storage, and utilization by cells throughout the body.

### Why It Matters

Vitamin E serves as one of your body''s primary defense systems against oxidative stress, protecting cell membranes from damage caused by free radicals. This protective function is crucial for maintaining the integrity of red blood cells, supporting immune function, and preventing cellular damage that can contribute to chronic disease processes. Adequate vitamin E levels support cardiovascular health by preventing the oxidation of LDL cholesterol, promote healthy skin and eyes, and play a role in neurological function. 

Low vitamin E levels may result from inadequate dietary intake, fat malabsorption disorders, or certain genetic conditions affecting vitamin E transport. Deficiency can lead to peripheral neuropathy, muscle weakness, and impaired immune response, though true deficiency is relatively rare in developed countries. While toxicity from dietary sources is uncommon due to vitamin E''s fat-soluble nature, extremely high supplemental doses can interfere with blood clotting.

### Key Factors

- **Dietary intake**: Nuts, seeds, vegetable oils, leafy greens, and fortified foods are primary sources
- **Fat absorption**: Conditions affecting fat digestion (celiac disease, Crohn''s disease, pancreatic disorders) can reduce vitamin E absorption
- **Supplementation**: High-dose supplements significantly affect blood levels but should be taken with food containing fat
- **Lipid levels**: Since vitamin E travels with lipoproteins, cholesterol levels can influence measurements
- **Smoking and alcohol**: Both increase oxidative stress and may deplete vitamin E stores more rapidly', 'claude-sonnet-4-5-20250929', '92239e08', '2026-03-19 07:21:35.503638+00', '2026-03-19 07:21:35.182+00'),
	('0499b72e-5890-4d35-8a25-8dc9ed0beea8', '98cb6012-6568-4f8d-86ba-75862d11e766', '# VLDL Cholesterol

### What It Measures

VLDL (Very Low-Density Lipoprotein) cholesterol is a type of lipoprotein particle produced primarily by the liver that serves as a major carrier of triglycerides through the bloodstream. Unlike LDL cholesterol, which primarily transports cholesterol to tissues, VLDL''s main cargo is triglycerides—fats that your body uses for energy. After your liver packages triglycerides into VLDL particles, these particles travel through your blood vessels, gradually releasing their triglyceride payload to cells throughout your body. As VLDL particles deliver their triglycerides, they become smaller and denser, eventually transforming into LDL particles.

The measurement of VLDL cholesterol is typically calculated rather than directly measured in standard lipid panels, usually estimated as one-fifth of your triglyceride value. This calculation reflects the cholesterol component contained within VLDL particles, though the majority of VLDL''s mass consists of triglycerides rather than cholesterol itself.

### Why It Matters

Elevated VLDL cholesterol contributes to cardiovascular disease risk by promoting the buildup of arterial plaque, similar to LDL cholesterol. High VLDL levels often signal that your body is producing excess triglycerides, which can indicate metabolic dysfunction, insulin resistance, or poor dietary habits. This makes VLDL an important marker for metabolic syndrome—a cluster of conditions that increase heart disease, stroke, and diabetes risk.

Because VLDL serves as a precursor to LDL particles, persistently high VLDL production can lead to elevated LDL cholesterol over time, compounding cardiovascular risk. Additionally, very high VLDL levels may indicate secondary conditions such as poorly controlled diabetes, hypothyroidism, or kidney disease. Conversely, optimal VLDL levels suggest efficient fat metabolism and good metabolic health, reflecting a balance between dietary intake, liver function, and your body''s energy demands.

### Key Factors

- **Dietary intake**: High consumption of refined carbohydrates, sugars, and saturated fats directly increases liver production of VLDL particles
- **Alcohol consumption**: Regular or excessive alcohol intake stimulates the liver to produce more VLDL
- **Body weight and insulin resistance**: Excess weight, particularly abdominal fat, and insulin resistance dramatically increase VLDL synthesis
- **Physical activity**: Regular exercise helps clear VLDL from the bloodstream and improves triglyceride metabolism
- **Metabolic conditions**: Diabetes, metabolic syndrome, and hypothyroidism can elevate VLDL production', 'claude-sonnet-4-5-20250929', '34d2c903', '2026-03-19 07:21:50.947602+00', '2026-03-19 07:21:49.871+00'),
	('98cacfc1-7d0f-4b28-914c-d4ec5c2848ca', '72b88cba-d849-4ee7-a4f0-8a198cf24408', '# White Blood Cells (WBC)

### What It Measures

White blood cells, or leukocytes, are your immune system''s frontline defenders circulating throughout your bloodstream. Unlike red blood cells that carry oxygen, white blood cells are specialized combat units designed to identify, attack, and eliminate threats like bacteria, viruses, fungi, and abnormal cells. Your bone marrow constantly produces these cells, releasing them into circulation where they patrol for invaders. The WBC count measures the total concentration of all white blood cell types combined—including neutrophils, lymphocytes, monocytes, eosinophils, and basophils—each with distinct immune functions. This measurement provides a snapshot of your immune system''s current activity level and capacity to respond to challenges.

### Why It Matters

Your white blood cell count serves as a vital indicator of immune system health and can reveal important information about infections, inflammation, and bone marrow function. Elevated WBC counts (leukocytosis) commonly signal that your body is actively fighting an infection, responding to physical stress, or dealing with inflammation. However, significantly high counts may also indicate more serious conditions requiring medical evaluation, including certain blood disorders or chronic inflammatory states. Conversely, low WBC counts (leukopenia) suggest a weakened immune response, which can result from viral infections, autoimmune conditions, nutritional deficiencies, or medications that suppress bone marrow activity. People with low counts face increased vulnerability to infections. Maintaining white blood cells within the optimal range ensures your immune system can mount appropriate responses to threats without being chronically overactive, which could indicate underlying inflammation.

### Key Factors

- **Acute infections**: Bacterial and viral infections trigger rapid WBC production and release
- **Chronic stress**: Physical or emotional stress elevates cortisol, which influences white blood cell distribution
- **Medications**: Corticosteroids, chemotherapy, antibiotics, and immunosuppressants directly affect WBC counts
- **Exercise timing**: Intense physical activity temporarily increases circulating white blood cells
- **Smoking**: Chronic tobacco use typically elevates baseline WBC counts due to ongoing inflammatory response
- **Autoimmune conditions**: Disorders affecting the immune system or bone marrow can raise or lower counts significantly', 'claude-sonnet-4-5-20250929', '79c3558f', '2026-03-19 07:22:19.997165+00', '2026-03-19 07:22:19.739+00'),
	('4c461e26-986e-4f27-ab76-bbafc69f1146', '403cee3f-1575-4a75-8c22-90be788d5e5f', '# Zinc

### What It Measures

Zinc is an essential trace mineral that plays a critical role in hundreds of enzymatic reactions throughout your body. A serum zinc test measures the concentration of zinc circulating in your bloodstream at the time of the blood draw. This mineral is involved in DNA synthesis, cell division, protein production, and wound healing. Zinc also serves as a structural component of numerous proteins and enzymes, helping them maintain their shape and function properly.

Your body cannot produce or store zinc in significant amounts, so you must obtain it regularly through diet or supplementation. The zinc measured in your blood represents only about 0.1% of your body''s total zinc, with the majority stored in muscle tissue, bones, and organs. While serum levels don''t perfectly reflect total body zinc stores, they provide valuable insight into your current zinc status and whether you''re getting adequate amounts from your diet.

### Why It Matters

Zinc deficiency can impair immune function, slow wound healing, cause hair loss, alter taste and smell perception, and contribute to skin problems. Severe deficiency is rare in developed countries but mild deficiency is more common, particularly among vegetarians, pregnant women, older adults, and people with digestive disorders that reduce absorption. Adequate zinc levels support a robust immune response, healthy skin integrity, proper thyroid function, and reproductive health in both men and women.

Conversely, excessively high zinc levels—usually from over-supplementation—can be problematic. Too much zinc can interfere with copper absorption, leading to copper deficiency, and may suppress immune function rather than enhance it. Elevated levels can also cause nausea, vomiting, and gastrointestinal distress. Maintaining zinc within the optimal range is important for balanced mineral status and overall metabolic health.

### Key Factors

- **Dietary intake**: Red meat, shellfish (especially oysters), nuts, seeds, legumes, and whole grains are primary sources
- **Supplementation**: Multivitamins, individual zinc supplements, and cold remedies containing zinc can significantly affect levels
- **Copper balance**: High zinc intake can deplete copper; these minerals compete for absorption
- **Digestive health**: Conditions like Crohn''s disease, celiac disease, or chronic diarrhea reduce zinc absorption
- **Vegetarian/vegan diets**: Plant-based diets may provide less bioavailable zinc due to phytates that inhibit absorption
- **Alcohol consumption**: Chronic alcohol use increases zinc excretion and reduces absorption', 'claude-sonnet-4-5-20250929', 'bdae4152', '2026-03-19 07:22:34.56421+00', '2026-03-19 07:22:34.257+00');


--
-- Data for Name: biomarker_favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: biomarker_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."biomarker_units" ("id", "biomarker_id", "unit", "is_default", "conversion_factor", "created_at") VALUES
	('88fd01be-4b44-4afb-8545-d5df2b2f25b3', '432a7bcc-c736-4bce-960d-19e68d6a15fe', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('611f7e61-3b71-488e-9ffc-86d72f45f41e', '432a7bcc-c736-4bce-960d-19e68d6a15fe', 'mmol/L', false, 38.67, '2026-03-08 08:50:58.180725+00'),
	('02e200c3-c33c-4adc-b052-6ae644e07b09', 'accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('cf45b070-2485-4a92-bcb7-608fbad4ccd9', 'accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', 'mmol/L', false, 38.67, '2026-03-08 08:50:58.180725+00'),
	('e0da0253-592a-4711-a2ae-1cfb7437fa47', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('330b6c39-5ee9-4c19-bd79-35d0a1bf85a2', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mmol/L', false, 38.67, '2026-03-08 08:50:58.180725+00'),
	('18625039-2643-4cbb-8a83-c33303264e50', '829a92af-7069-44a2-a79a-e01c2f7abb2c', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('0f17fac2-9de1-4e51-ab16-d0e392373c80', '829a92af-7069-44a2-a79a-e01c2f7abb2c', 'mmol/L', false, 88.50, '2026-03-08 08:50:58.180725+00'),
	('c3260b23-f748-4975-8b50-6cc4dd737534', '98cb6012-6568-4f8d-86ba-75862d11e766', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('7d5166c8-48c1-4705-baa5-c553660ea78f', '98cb6012-6568-4f8d-86ba-75862d11e766', 'mmol/L', false, 38.67, '2026-03-08 08:50:58.180725+00'),
	('b92583d4-4740-4db0-8384-b34c39d4352b', '1e6e9873-a41d-495c-93f0-9eba4f7eacb6', 'ratio', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('65aa334f-3cca-49ad-8913-fe9bf03b7cf5', 'c59c5228-d5d5-4a70-806e-70170982b135', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('08b274c1-6090-4ea7-8043-b36bb7dbb0a7', 'c59c5228-d5d5-4a70-806e-70170982b135', 'mmol/L', false, 18.02, '2026-03-08 08:50:58.180725+00'),
	('e6bee21f-1831-4f7d-8fce-4b3d671df3c6', '216dd455-f0ea-4337-9607-ceaf1bf806dd', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('14f567ca-5a56-4b63-aef2-8125c2b506d4', 'f269ef8f-3b2d-444c-b26a-03b45d082b94', 'uIU/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('48e31f08-e32c-4c66-b1a2-859ca1d95669', 'f269ef8f-3b2d-444c-b26a-03b45d082b94', 'pmol/L', false, 0.1667, '2026-03-08 08:50:58.180725+00'),
	('671fa1f2-bbfe-4c6e-9294-49a8a333af52', '2eff0519-c47b-44ed-b605-a698e1f47dbc', 'index', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('2504e65d-296d-4a3d-ad54-92eab77ffb82', '8946d072-a3f0-4227-bfca-f749c031781b', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1f02ae70-97bf-49b9-b892-b71ce21401c4', '8946d072-a3f0-4227-bfca-f749c031781b', 'nmol/L', false, 3.03, '2026-03-08 08:50:58.180725+00'),
	('69c37380-106a-412c-b37e-acf5fc80d343', '3ba846a9-a038-44c4-b70c-f4f7f994d68c', 'U/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('dc2b3118-a039-4350-8ac9-97b6eac62074', 'bc96eedf-8e6c-4a97-940b-8585412f95b0', 'U/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('4e7df2e8-c3df-4e58-9752-f90a3f6fc3c6', '355ce86b-8434-4e00-8974-8cbdfec20dcb', 'U/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('12e77ed1-6ca2-4a53-99aa-e960f3a5eb79', '22f611f9-40ef-4c65-9001-cb26eaf2f8ec', 'U/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('cd4e777b-ce59-4771-bc8d-cf101a5f4c3b', 'e8941ddf-d7fb-4401-9bcc-852ebfeda0df', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('e610aa83-6f57-4a8a-8d94-d0447a540f31', 'e8941ddf-d7fb-4401-9bcc-852ebfeda0df', 'umol/L', false, 0.0585, '2026-03-08 08:50:58.180725+00'),
	('6301bd5d-6db5-4adf-9870-3321611897fb', '666352d2-5792-46d9-b952-708d653133a9', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('4d344ad5-8210-4945-ae72-dfaef64be0ea', '666352d2-5792-46d9-b952-708d653133a9', 'umol/L', false, 0.0585, '2026-03-08 08:50:58.180725+00'),
	('4f34580e-2425-4941-96db-8852d3f41867', '7f631e62-f5aa-43e7-978e-6ca98d43ee71', 'g/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('5c225d52-59bc-4db3-8e67-6dd67614e233', '7f631e62-f5aa-43e7-978e-6ca98d43ee71', 'g/L', false, 0.1, '2026-03-08 08:50:58.180725+00'),
	('7b73aee9-6a13-41e0-85d4-b79144ab2485', 'aa1ecabb-8354-4f49-8665-e546c76a0c30', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('2a4676f8-0368-4164-b3cb-b99d96d244e1', '573cfaa7-cc86-49fd-958f-4c421840635d', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1ae49e28-3cf3-433c-b0d9-44e9f38f584c', '573cfaa7-cc86-49fd-958f-4c421840635d', 'umol/L', false, 0.0113, '2026-03-08 08:50:58.180725+00'),
	('5345eeeb-dcb0-4c9f-9c81-a26ce9d8ec58', '191fce1e-4049-4719-9b21-5c0048e7512a', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('cb61545d-e267-4ede-ad07-62dead1f47b5', '191fce1e-4049-4719-9b21-5c0048e7512a', 'mmol/L', false, 2.80, '2026-03-08 08:50:58.180725+00'),
	('bc6567f4-2a34-49a3-8fd7-05d819111a1a', 'ea192bf4-d73d-4be5-a6f7-7085c54dd628', 'mL/min/1.73m2', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('99acc8df-6c1c-4cfe-8baa-3d299d73e76a', '6c7e3e16-377b-498c-8137-0c518f5536fb', 'mg/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('c1ee0b70-fa73-48d1-83f0-9436a7d42206', '79d7d5c7-d7c8-46c4-a8e4-3fbe627f3a9e', 'ratio', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('626203c7-cd24-4239-988c-3710f4bc5f58', '1e8ad3b0-69d9-4d44-bf59-ec222dd278db', 'mIU/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('56bb4728-2ded-4f5b-9f32-bafc213f4300', '814520f7-892c-4b7d-955f-e87cfeefb28b', 'ng/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('7a3d2697-6a8b-46b8-a4ab-3359b475aaaa', '814520f7-892c-4b7d-955f-e87cfeefb28b', 'pmol/L', false, 0.0775, '2026-03-08 08:50:58.180725+00'),
	('d900dda5-f95f-4cf0-b603-93f39c9d0b8f', 'c5e3a987-e8cb-46e2-97e7-79d75445aa72', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('0830c1da-148b-48aa-8b39-b3a00d28c230', 'c5e3a987-e8cb-46e2-97e7-79d75445aa72', 'pmol/L', false, 0.6494, '2026-03-08 08:50:58.180725+00'),
	('f63b14e9-bfb5-4b3d-a344-0ab051257891', 'da1e8419-a0e5-4ed4-b3a6-a961d97149c6', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('4db6fa01-cc85-4c5e-bf29-18f0dabae369', 'da1e8419-a0e5-4ed4-b3a6-a961d97149c6', 'nmol/L', false, 0.0775, '2026-03-08 08:50:58.180725+00'),
	('a8e1bb5c-92c9-431b-9746-a6046a507a30', '4050a09d-8aa0-411f-8df9-be15222e8f11', 'ng/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('88d15aa6-4d56-47f5-b8fd-8033f37ffa5b', '4050a09d-8aa0-411f-8df9-be15222e8f11', 'nmol/L', false, 64.94, '2026-03-08 08:50:58.180725+00'),
	('3ee2f710-f728-487a-afc0-a923050b8c0e', 'c26c416c-0143-4a94-b94e-28ab0735119f', 'IU/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('d6b7c77a-e4bc-4b2d-a3e2-e2364ce78da6', 'a908e197-5c9e-4aa5-9a76-a8a38a0b9c2f', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('349d9963-6c2b-4e93-b5fb-8e8291d29bb8', '69ba9187-b336-48c8-9eac-bdb7a189b322', 'ng/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('f60d1adf-6725-49f2-bc9f-ebe318e1c1f9', '72b88cba-d849-4ee7-a4f0-8a198cf24408', 'x10^3/uL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('d0f19fab-37ff-428f-83f4-8d6baf9d5dec', '3a33d3a0-a1b6-48fe-832e-737a98e1eb68', 'x10^6/uL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('f3f82362-413d-464e-8cca-0d5ad5dfd5d7', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('9cdbdac8-a658-4ce2-b236-fc7a25285629', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/L', false, 0.1, '2026-03-08 08:50:58.180725+00'),
	('fe2877f9-cb1f-4228-8f14-57ea0cb628f7', '9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('712349c7-608f-4553-9218-808d67f00d1f', '3e2b80bf-c4dc-4bf4-a008-b2dbc5291480', 'fL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('dfb03f57-079b-43f0-afe2-33c1fb24908e', '33d595ad-91a6-4f7c-99b2-156a44fe0d21', 'pg', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('17e5c1cb-be1b-4b33-bdab-a0c5c819a210', 'b113d56f-95a6-4da0-a83b-d13b563ac83c', 'g/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('375faa91-970a-45ef-9645-68d17b5c10a0', '183533e4-a28c-4741-b46c-328aaeb1f1c2', 'x10^3/uL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('991705f4-eb6a-480d-b4cd-075c06fae24e', 'afd349f5-9795-4b8d-970f-681d17239e3c', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('46f7039e-0098-4e23-8d84-8c80a088e788', '7747eb00-64f2-4326-b2ed-708c4268d14c', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('3a68e745-24e8-4fd4-9a89-b62021ed903e', '0ae5b34d-ba7a-4b93-9232-3f08e10bd01a', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('8fcf5d5d-ebfe-4516-bc37-41757b1c0f97', 'ee2459d7-bec7-4c27-9487-c8864ebe5e79', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('ef2c4b74-c59e-401e-b6b2-9a8698be6e2c', 'e2f8a4bb-f9d3-4015-99a3-2e92dd7dcf89', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('bf384cc6-fba4-4bb7-b51f-b2bd5688c7f0', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('3e750825-a6c1-410e-b956-c2326dbea0c6', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'umol/L', false, 5.587, '2026-03-08 08:50:58.180725+00'),
	('197c0209-8620-4e5e-b584-4cbd5fdd58bc', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('641e78e2-765f-4c2e-b247-0711a147728f', 'dfa1976d-d5fb-4edf-89d8-65ec5a08d24f', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('8b9e72de-6783-4506-a77a-037645787803', 'da237a49-9617-43d5-9e7a-eb2397d51930', '%', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('b3637f17-7ee6-42f0-8bf1-1f10242a5e11', '81f6fe68-a414-4dce-83d7-1302c118ff9f', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('565cc9cf-b2b8-4e48-aadb-1736d35308ec', '81f6fe68-a414-4dce-83d7-1302c118ff9f', 'nmol/L', false, 0.4006, '2026-03-08 08:50:58.180725+00'),
	('1ba619d6-4bdb-40a9-b621-ad78810bccbf', '4ebcc5e1-4412-49e7-852d-c0da36e82217', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('9a0ef827-a0a1-4d0f-b3e9-1a5e4df6e20e', '4ebcc5e1-4412-49e7-852d-c0da36e82217', 'pmol/L', false, 1.355, '2026-03-08 08:50:58.180725+00'),
	('5533afe8-7a32-49a8-82f8-15ee1159fb97', 'e58eb066-b200-44c4-a169-c110050b8993', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('28507231-500f-4bc0-ab26-951b40df3863', 'e58eb066-b200-44c4-a169-c110050b8993', 'nmol/L', false, 0.4413, '2026-03-08 08:50:58.180725+00'),
	('693df8e8-1565-4a55-b693-29ea4c3fa72c', 'c30dc184-6d2e-4c1c-a325-b209752706e0', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('9e756ca6-2e1c-46b3-95d5-d763dc886072', 'c30dc184-6d2e-4c1c-a325-b209752706e0', 'nmol/L', false, 0.2473, '2026-03-08 08:50:58.180725+00'),
	('bc35940b-ff7e-42ae-8e5a-d6a4efccc1cb', '19caacbd-21f8-419c-8d8e-9e382350f66d', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('a55eff2f-9135-47f3-88d4-9d94cac96c60', '19caacbd-21f8-419c-8d8e-9e382350f66d', 'umol/L', false, 28.65, '2026-03-08 08:50:58.180725+00'),
	('6f32ef97-2665-443a-8bcb-2ba2528042f2', 'a0095d05-82fa-46dc-b6f5-0e15fbed1a22', 'mg/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('48fd70dd-288e-4d97-8e13-3556a847269f', 'a0095d05-82fa-46dc-b6f5-0e15fbed1a22', 'umol/L', false, 0.4307, '2026-03-08 08:50:58.180725+00'),
	('07fbf01c-47fe-4f1d-9054-28b81f75d263', 'f3933a85-57ad-495d-bd02-f81216189665', 'nmol/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('e3061c3c-8af0-45d7-a63a-7a7d5e3e70d0', 'b116af7b-d1b4-4218-ba0c-c54afd82a620', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('b0fefa47-8dd5-4e3e-9800-49a811d7d4ff', 'b116af7b-d1b4-4218-ba0c-c54afd82a620', 'mmol/L', false, 2.431, '2026-03-08 08:50:58.180725+00'),
	('b6cdc186-2867-41a6-a533-e7ce83b49997', '403cee3f-1575-4a75-8c22-90be788d5e5f', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('3ca40057-da93-427c-a45a-5f89410ac5a0', 'd9c45588-2735-4a11-8331-1bc26ad710af', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('5712f910-e6bb-4523-998f-a62f3bfce30b', 'd9c45588-2735-4a11-8331-1bc26ad710af', 'mmol/L', false, 4.0, '2026-03-08 08:50:58.180725+00'),
	('b89ff6a4-664b-4037-a749-05d209d6e97d', 'd6a11311-df16-4548-a344-6640d688d511', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('b771eba0-bffd-4cd1-a777-4b14786b1b9d', 'd6a11311-df16-4548-a344-6640d688d511', 'mmol/L', false, 3.096, '2026-03-08 08:50:58.180725+00'),
	('d6a2a48b-1b8c-4bf6-bebe-6a6cbffc5b59', '1d228032-6e7d-48ae-8a9d-f849c702b954', 'ng/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('29a34afb-e7e2-4e33-9889-639f38b23cd6', '1d228032-6e7d-48ae-8a9d-f849c702b954', 'nmol/L', false, 28.82, '2026-03-08 08:50:58.180725+00'),
	('c6e134c2-c37f-46c8-959e-2ed17520ae9e', 'd60fdd91-2128-443f-9385-8d6be8b604f9', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('0c5043c0-7136-45bb-a495-3da08ef89ccb', 'd60fdd91-2128-443f-9385-8d6be8b604f9', 'pmol/L', false, 0.2884, '2026-03-08 08:50:58.180725+00'),
	('52a90089-e0a0-4966-a489-6a9a1dff8bdb', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('26215a03-a798-4bea-b62a-99caca482888', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'pmol/L', false, 0.2724, '2026-03-08 08:50:58.180725+00'),
	('224c4d6d-995f-4c5d-9b3f-7ecb26114fbd', '9db5003c-a571-4d2e-871a-0729b3c0f769', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('4577c66e-aad3-4902-b8d1-2eb0626e765b', '9db5003c-a571-4d2e-871a-0729b3c0f769', 'nmol/L', false, 0.3145, '2026-03-08 08:50:58.180725+00'),
	('97e8c39c-0d64-4ca8-8147-c52b7288de21', 'f57e5dfb-866b-4df2-b571-b2d17eca1896', 'mIU/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1ac3f155-e3ea-455a-800f-425bb54c6c17', '44275c87-03aa-4b77-b736-cc5d68880ce4', 'mIU/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('3a69d0a3-c962-45e1-a626-fb356365d334', '0b68518d-f31d-4586-b13c-3b7f9d90c833', 'nmol/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('5d223b0d-cbbe-4075-829a-05bc1d780c34', '9e979e68-51a5-4153-a14c-a060a78db4d1', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('ca6f3300-7bbb-4613-9de8-bdf9f859aa5c', '8b2e3954-b08a-422c-87e5-ffbd4eaaa58f', 'ng/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('a3a3d788-09f2-46e8-b32c-087c0b4f53b6', 'd33003ee-2ccd-489a-bdff-2bad14c5631d', 'ug/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('ce602767-e49b-4ce8-96f4-f61b863cea1a', 'd33003ee-2ccd-489a-bdff-2bad14c5631d', 'nmol/L', false, 0.0362, '2026-03-08 08:50:58.180725+00'),
	('967366a4-f886-4b69-b2ad-58d7433866b3', 'c1ecae4e-6b1b-4b32-a5f9-c6ebfe8240ef', 'mg/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('868d7432-a202-4517-b784-b26ee1e26d0c', '86fac295-50fc-470d-92ce-6ab64766a7ba', 'mm/hr', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('5ec31815-2bd2-47f8-bde6-b80fd24a0662', '78c24a5d-b909-4e85-86c9-60ae7eca06a9', 'mg/dL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1644dfd1-2d51-42f2-90b3-45ee2e77d537', '3885e9a3-d5df-4396-9355-33e33a56fe07', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('d787aef6-5ef4-4dd8-8ec4-53c52fcfb5c7', 'd766f973-be93-4d3f-b770-4d367b1c6792', 'pg/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1bbb615c-add1-4200-896b-6f973053949c', '21d8f34c-7136-45bc-a14b-5324eb054f0f', 'ng/mL', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('3a708a0a-0fde-42af-b8c0-c04e7198bcca', '98a709e6-bb1c-4c08-9609-785a25d28f5c', 'nmol/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('82d21ca3-afd1-4f53-8ba1-176c4511cc69', 'b1eba466-8842-4015-8af3-373f326d6794', 'nmol/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('2148e4a5-5232-4cec-aa83-be726cffde5e', '4c517970-d387-4deb-ad17-88f048898f30', 'mEq/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('4a49866a-a0e2-4061-9a75-3f6ec1aabf24', '6bc7cc4c-3ff2-4ed1-bce7-b95fe3364c60', 'mEq/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('39623273-1f30-4b3b-8bac-14b2f41290d6', '3a0ce50d-3630-4256-8cee-8c5fd1fe2036', 'mEq/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('c2372efd-4105-4173-93e7-f04acbd01ac1', 'b7a58442-fdcc-49db-9931-f37e23a57b1d', 'mEq/L', true, 1.0, '2026-03-08 08:50:58.180725+00'),
	('1857e1b5-de16-451b-9c5e-393ea1cac611', '19bdab1d-6478-4e27-9250-d053dc67520e', '%', true, 1.0, '2026-03-08 13:40:13.289796+00'),
	('6be66181-1aad-4c14-aeef-0f3fe324de4a', '04816c82-cb1a-4f5d-9369-25cfab2385ab', 'µmol/L', true, 1.0, '2026-05-03 14:32:04.222867+00'),
	('c4c4f1dc-530e-415a-bc21-bf8436ec18bb', '04816c82-cb1a-4f5d-9369-25cfab2385ab', 'mg/L', false, 7.397, '2026-05-03 14:32:04.222867+00'),
	('4f7f3341-7ce9-4d57-8def-b37f526980d3', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'ug/dL', false, 0.02714, '2026-03-08 08:50:58.180725+00'),
	('c0b1c0a1-f355-4497-a912-b90732d3c902', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'umol/L', true, 1.0, '2026-03-08 08:50:58.180725+00');


--
-- Data for Name: blood_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: body_goals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: body_log_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_threads; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_document_extractions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_memory_files; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: clinvar_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: custom_foods; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dexa_scans; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dexa_regions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dutch_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dutch_computed_values; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dutch_markers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."dutch_markers" ("id", "name", "short_name", "category", "unit", "description", "ref_range_low", "ref_range_high", "ref_range_low_male", "ref_range_high_male", "ref_range_low_female", "ref_range_high_female", "aliases", "created_at", "parent_id", "variant_name", "panel_id", "archived_at", "loinc_code", "method") VALUES
	('c70fbb48-9169-4f83-8421-5e295ba8ba8e', 'Estrone (Urine)', 'E1', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{E1,Estrone}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('65b40c01-407f-40da-9f29-cf09099a8b18', 'Estradiol (Urine)', 'E2', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{E2,Estradiol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('e3b4640f-a78c-425f-a7ce-ff1cfb9db2d1', 'Estriol (Urine)', 'E3', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{E3,Estriol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('c0e316d8-e697-4eee-914b-59123cd73377', 'Testosterone (Urine)', 'T', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{T,Testosterone}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('8ef00744-9709-422c-b0ed-26cdcf169487', 'Androsterone', 'Andro', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Andro,Androsterone}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('5d2de796-6165-46c1-a870-4605c83385ec', 'Etiocholanolone', 'Etio', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Etio,Etiocholanolone}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('bb1bf920-55a5-4abc-a1a5-6a2d4e008cde', '5b-Androstanediol', '5b-Adiol', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{5b-Adiol,5b-Androstanediol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('2fa69078-961a-4cc0-b68c-ff858a67e697', 'DHEA-S (Urine)', 'DHEA-S', 'dutch_adrenal', 'ug/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{DHEA-S,DHEAS}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('3980cf36-7dec-445d-8d6b-010501aae378', 'Free Cortisol (Urine)', 'F-Cortisol', 'dutch_adrenal', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{F-Cortisol,"Free Cortisol"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('96bcef08-6c8b-44cd-a30f-a166531d1747', 'Free Cortisone (Urine)', 'F-Cortisone', 'dutch_adrenal', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{F-Cortisone,"Free Cortisone"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('2b7bdfaa-38e1-4440-8028-34ac2cd405aa', 'a-Tetrahydrocortisol', 'a-THF', 'dutch_adrenal', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{a-THF,a-Tetrahydrocortisol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('b771baf8-1155-44d8-b36b-a0b2038c025f', 'b-Tetrahydrocortisol', 'b-THF', 'dutch_adrenal', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{b-THF,b-Tetrahydrocortisol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('de54c880-4560-46cb-88a2-439743c36edc', 'b-Tetrahydrocortisone', 'b-THE', 'dutch_adrenal', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{b-THE,b-Tetrahydrocortisone}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('b353cf8c-4831-435f-a7df-83c438d8a635', 'a-Pregnanediol', 'a-PD', 'dutch_progesterone', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{a-PD,a-Pregnanediol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('66a82131-c556-41f6-8a4d-0cb0e450e4da', 'b-Pregnanediol', 'b-PD', 'dutch_progesterone', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{b-PD,b-Pregnanediol}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('7647b783-5d41-4ffd-9c2d-54d1067ae08d', 'Homovanillic Acid', 'HVA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{HVA,"Homovanillic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('e1dde187-7236-4318-8de1-9e7bf3fde5ec', 'Vanillylmandelic Acid', 'VMA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{VMA,"Vanillylmandelic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('613da781-cd6f-4d53-84f7-48277ab0c3df', 'Kynurenic Acid', 'KynA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{KynA,"Kynurenic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('36a166f6-e2a9-4e59-860d-a2266a5686db', 'Quinolinic Acid', 'QA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{QA,"Quinolinic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('64992e6e-296a-456f-a834-b9276468ec55', 'Methylmalonic Acid', 'MMA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{MMA,"Methylmalonic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('e46c4ef3-61d1-4f76-be13-8456207ff176', 'Xanthurenic Acid', 'XA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{XA,"Xanthurenic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('69128082-ca7d-4676-9d0c-1c7829648237', 'Pyroglutamic Acid', 'PGA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{PGA,"Pyroglutamic Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('193c7e6d-fac2-4291-ba02-c68f959fe097', '3-Hydroxyisovaleric Acid', '3-HIVA', 'dutch_oat', 'ug/g', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{3-HIVA,"3-Hydroxyisovaleric Acid"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('f3873efb-2cc2-43df-bae2-dde476947a0b', 'Indican', 'Ind', 'dutch_oat', 'mg/L', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Ind,Indican}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('4a95263c-51ea-43b6-82e3-15075debeaac', '8-OHdG', '8-OHdG', 'dutch_other', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{8-OHdG,8-Hydroxy-2-deoxyguanosine}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('60408338-63ee-433d-a24b-08452ffe441c', 'Melatonin (6-OHMS)', 'Mel', 'dutch_other', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Mel,6-OHMS,Melatonin,"6-Hydroxymelatonin Sulfate"}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('87a767ea-8114-42d5-9065-be27fce59296', 'Creatinine (Urine)', 'Cr-U', 'dutch_other', 'mg/dL', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Cr-U,Creatinine}', '2026-04-06 10:10:37.806208+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('bfd7f70b-887b-4dc9-b68a-3bea0be50420', '2-Hydroxyestrone', '2-OH-E1', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{2-OH-E1,2-OHE1}', '2026-04-06 10:10:37.806208+00', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', NULL, NULL, NULL, NULL, NULL),
	('3f983996-ac12-45b6-b7a7-60796972a29e', '4-Hydroxyestrone', '4-OH-E1', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{4-OH-E1,4-OHE1}', '2026-04-06 10:10:37.806208+00', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', NULL, NULL, NULL, NULL, NULL),
	('1d3e5c35-5aed-42f8-8ccb-e77486d2dfd4', '16-Hydroxyestrone', '16-OH-E1', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{16-OH-E1,16-OHE1}', '2026-04-06 10:10:37.806208+00', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', NULL, NULL, NULL, NULL, NULL),
	('ad64bc6f-3c31-4f24-a67a-4847e07ccc67', '2-Hydroxyestradiol', '2-OH-E2', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{2-OH-E2,2-OHE2}', '2026-04-06 10:10:37.806208+00', '65b40c01-407f-40da-9f29-cf09099a8b18', NULL, NULL, NULL, NULL, NULL),
	('3c2548d6-bdca-49e0-845a-53b3c14e988b', '4-Hydroxyestradiol', '4-OH-E2', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{4-OH-E2,4-OHE2}', '2026-04-06 10:10:37.806208+00', '65b40c01-407f-40da-9f29-cf09099a8b18', NULL, NULL, NULL, NULL, NULL),
	('4a526a27-b6bb-449f-ae8e-77b9c6b72e49', '5a-DHT (Urine)', 'DHT', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{DHT,5a-DHT,Dihydrotestosterone}', '2026-04-06 10:10:37.806208+00', 'c0e316d8-e697-4eee-914b-59123cd73377', NULL, NULL, NULL, NULL, NULL),
	('7ca5c534-61e6-4562-a97a-c63b938274a3', 'Epi-Testosterone', 'Epi-T', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{Epi-T,Epi-Testosterone,Epitestosterone}', '2026-04-06 10:10:37.806208+00', 'c0e316d8-e697-4eee-914b-59123cd73377', NULL, NULL, NULL, NULL, NULL),
	('f6b76808-0147-4072-b0b1-23807380af5f', '2-Methoxyestrone', '2-MeOE1', 'dutch_estrogen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{2-MeOE1,2-Methoxyestrone}', '2026-04-06 10:10:37.806208+00', 'bfd7f70b-887b-4dc9-b68a-3bea0be50420', NULL, NULL, NULL, NULL, NULL),
	('066042e0-da25-4537-928f-3284062ffc06', '5a-Androstanediol', '5a-Adiol', 'dutch_androgen', 'ng/mg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{5a-Adiol,5a-Androstanediol}', '2026-04-06 10:10:37.806208+00', '4a526a27-b6bb-449f-ae8e-77b9c6b72e49', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: dutch_marker_descriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dutch_marker_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."dutch_marker_units" ("id", "biomarker_id", "unit", "is_default", "conversion_factor", "created_at") VALUES
	('7ee81257-1bd8-461a-9f2b-4119389a6584', 'c0e316d8-e697-4eee-914b-59123cd73377', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('c77dee3a-71a2-4527-9359-bdaf45358d7a', '8ef00744-9709-422c-b0ed-26cdcf169487', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('7e08179b-793c-4b24-ba24-21d094608a6c', '5d2de796-6165-46c1-a870-4605c83385ec', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('28654f51-6082-400a-9c27-25350a42b681', 'bb1bf920-55a5-4abc-a1a5-6a2d4e008cde', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('e404f868-740a-4f54-af17-601e8f1d94bb', '4a526a27-b6bb-449f-ae8e-77b9c6b72e49', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('a0a9b890-075e-47b4-8ed3-70b9bbc12d19', '7ca5c534-61e6-4562-a97a-c63b938274a3', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('54d553a9-3dd5-4a7d-bfb6-147e2dda518e', '066042e0-da25-4537-928f-3284062ffc06', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('c05da0e4-edd3-48d3-b91a-df7ede201231', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('7cf27269-cd8e-42f0-aab0-e1efad2386e1', '65b40c01-407f-40da-9f29-cf09099a8b18', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('71027806-6049-4050-8bdc-e2c617bbdfdc', 'e3b4640f-a78c-425f-a7ce-ff1cfb9db2d1', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('807c95d5-441a-4e7d-95bd-08194bb38ae6', 'bfd7f70b-887b-4dc9-b68a-3bea0be50420', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('b46fc2fe-8de7-4ede-ab81-ce8fbd755fd7', '3f983996-ac12-45b6-b7a7-60796972a29e', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('63397e02-5fbf-48d4-9996-65706e5fbf20', '1d3e5c35-5aed-42f8-8ccb-e77486d2dfd4', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('402292c8-a3b9-4373-9f5b-ba0c2fa0d3dc', 'ad64bc6f-3c31-4f24-a67a-4847e07ccc67', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('dd9ef069-11ac-4432-9adb-99473146c98b', '3c2548d6-bdca-49e0-845a-53b3c14e988b', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('68f09ecf-2238-47e4-acae-9eb8fc681067', 'f6b76808-0147-4072-b0b1-23807380af5f', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('ec50c627-b29e-47ee-9b4d-eaa39355e0bb', 'b353cf8c-4831-435f-a7df-83c438d8a635', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('887a40f1-16e1-46f9-b21e-f909e2c28801', '66a82131-c556-41f6-8a4d-0cb0e450e4da', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('2076d6d7-61d9-4559-b6bf-3feee7a94a93', '3980cf36-7dec-445d-8d6b-010501aae378', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('f881a9ac-c3ed-4fca-9b31-f2e0b971f62f', '96bcef08-6c8b-44cd-a30f-a166531d1747', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('e415a61e-c730-4472-9982-0189120f470c', '2b7bdfaa-38e1-4440-8028-34ac2cd405aa', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('41bbc406-2aef-467f-93ef-b1691470b053', 'b771baf8-1155-44d8-b36b-a0b2038c025f', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('4b51b5a1-189e-49d7-b666-5c35f7da6511', 'de54c880-4560-46cb-88a2-439743c36edc', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('6f39d2b0-aa8e-4288-a44d-ae04b883e1e2', '2fa69078-961a-4cc0-b68c-ff858a67e697', 'ug/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('39b07436-617c-4617-b104-3ef8bc329ba1', '7647b783-5d41-4ffd-9c2d-54d1067ae08d', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('977d2029-5326-47e9-9855-4845f3e98e75', 'e1dde187-7236-4318-8de1-9e7bf3fde5ec', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('5e0b7f0e-5ab9-41e2-8543-51b705f412b6', '613da781-cd6f-4d53-84f7-48277ab0c3df', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('5bfb8dc3-0ee2-4ba9-b078-0a288b964bc6', '36a166f6-e2a9-4e59-860d-a2266a5686db', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('d434c8d2-68f9-4513-bce1-384bb67cdaae', '64992e6e-296a-456f-a834-b9276468ec55', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('58f25c78-91aa-4c2a-ab2a-d2fa7cacdbb0', 'e46c4ef3-61d1-4f76-be13-8456207ff176', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('51575c33-f7e0-440b-aea0-b573fe2fe056', '69128082-ca7d-4676-9d0c-1c7829648237', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('423d9cb1-1600-4ef3-9b65-55c7f3706d1d', '193c7e6d-fac2-4291-ba02-c68f959fe097', 'ug/g', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('41227013-c57b-4a1c-bad5-3e7998e08124', 'f3873efb-2cc2-43df-bae2-dde476947a0b', 'mg/L', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('6bb7e9ed-e196-49dc-9856-eb3a2aa8687f', '4a95263c-51ea-43b6-82e3-15075debeaac', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('4acebc8e-cb58-4678-8517-62ea8bd89790', '60408338-63ee-433d-a24b-08452ffe441c', 'ng/mg', true, 1.0, '2026-04-06 10:10:37.806208+00'),
	('3914eed3-bfd1-46af-8bb4-d433846ecc40', '87a767ea-8114-42d5-9065-be27fce59296', 'mg/dL', true, 1.0, '2026-04-06 10:10:37.806208+00');


--
-- Data for Name: dutch_reference_ranges; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."dutch_reference_ranges" ("id", "biomarker_id", "unit", "sex", "age_min", "age_max", "range_low", "range_high", "source", "created_at", "range_type", "phase", "source_url", "verified_at", "verified_by") VALUES
	('e7a3cdbb-6c98-4da1-91db-424cbec9de54', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', 'ng/mg', 'female', NULL, NULL, 1.0, 8.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'postmenopausal', NULL, NULL, NULL),
	('8dc01bd8-4e74-406c-b788-b0dd32df3896', 'c70fbb48-9169-4f83-8421-5e295ba8ba8e', 'ng/mg', 'male', NULL, NULL, 1.5, 10.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('ba57d1e2-52be-4f4a-ae87-ba9e66a7f0b9', '65b40c01-407f-40da-9f29-cf09099a8b18', 'ng/mg', 'female', NULL, NULL, 0.5, 4.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'follicular', NULL, NULL, NULL),
	('c409f1fc-138b-41d2-803e-bda0fdda2bf9', '65b40c01-407f-40da-9f29-cf09099a8b18', 'ng/mg', 'male', NULL, NULL, 0.5, 3.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('e2f06696-b11a-4018-892d-7d202f711d25', 'e3b4640f-a78c-425f-a7ce-ff1cfb9db2d1', 'ng/mg', 'female', NULL, NULL, 0.5, 5.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'postmenopausal', NULL, NULL, NULL),
	('79bf6c33-4083-4ec2-8786-e24a2cc38e20', 'e3b4640f-a78c-425f-a7ce-ff1cfb9db2d1', 'ng/mg', 'male', NULL, NULL, 0.8, 5.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d4bc32b6-b7f8-4792-b023-be58e0c433dc', 'bfd7f70b-887b-4dc9-b68a-3bea0be50420', 'ng/mg', 'female', NULL, NULL, 1.0, 8.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'luteal', NULL, NULL, NULL),
	('40200a7a-9fd4-4b31-a340-668ce6f9a115', 'bfd7f70b-887b-4dc9-b68a-3bea0be50420', 'ng/mg', 'male', NULL, NULL, 0.5, 4.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('6dfd2f4b-6aa7-4dca-ac4a-eca37e52a7d2', '3f983996-ac12-45b6-b7a7-60796972a29e', 'ng/mg', 'female', NULL, NULL, 0.1, 0.8, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'postmenopausal', NULL, NULL, NULL),
	('74172ef1-b361-4c5a-bb99-150452911ca8', '3f983996-ac12-45b6-b7a7-60796972a29e', 'ng/mg', 'male', NULL, NULL, 0.1, 1.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d74510d4-5394-4bb4-aaf9-cddfba048067', '1d3e5c35-5aed-42f8-8ccb-e77486d2dfd4', 'ng/mg', 'female', NULL, NULL, 0.3, 3.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'follicular', NULL, NULL, NULL),
	('ae7ddb7c-a1c5-4424-8061-4d826c0877aa', '1d3e5c35-5aed-42f8-8ccb-e77486d2dfd4', 'ng/mg', 'male', NULL, NULL, 0.3, 3.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d7b5634b-d088-4e85-85bd-52fbcfeeb17a', 'ad64bc6f-3c31-4f24-a67a-4847e07ccc67', 'ng/mg', 'female', NULL, NULL, 0.5, 4.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'luteal', NULL, NULL, NULL),
	('a71dc38b-275b-48af-8d20-bbf3b3f53c0c', 'ad64bc6f-3c31-4f24-a67a-4847e07ccc67', 'ng/mg', 'male', NULL, NULL, 0.2, 2.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('ed7d92dd-b4c7-4eb5-be6e-48152d332a96', '3c2548d6-bdca-49e0-845a-53b3c14e988b', 'ng/mg', 'female', NULL, NULL, 0.05, 0.5, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'follicular', NULL, NULL, NULL),
	('043e081e-c111-42e7-be1d-6794cd7a807b', '3c2548d6-bdca-49e0-845a-53b3c14e988b', 'ng/mg', 'male', NULL, NULL, 0.05, 0.5, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('b55a9aee-1e7e-4da6-8a40-34c495cb71f2', 'f6b76808-0147-4072-b0b1-23807380af5f', 'ng/mg', 'female', NULL, NULL, 0.5, 6.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'luteal', NULL, NULL, NULL),
	('05875d88-9077-4cc1-869e-cf7494996a7b', 'f6b76808-0147-4072-b0b1-23807380af5f', 'ng/mg', 'male', NULL, NULL, 0.3, 3.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('b36e210f-ebea-47b8-9a86-35ceb956af7a', 'c0e316d8-e697-4eee-914b-59123cd73377', 'ng/mg', 'female', NULL, NULL, 2.0, 15.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'luteal', NULL, NULL, NULL),
	('ba491d58-e7db-419d-9c97-3e281097e562', 'c0e316d8-e697-4eee-914b-59123cd73377', 'ng/mg', 'male', NULL, NULL, 20.0, 120.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('f7fb8531-8710-4968-be1a-8c59fe0c1388', '4a526a27-b6bb-449f-ae8e-77b9c6b72e49', 'ng/mg', 'female', NULL, NULL, 1.5, 12.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'luteal', NULL, NULL, NULL),
	('2aafd26c-e554-4ae2-985f-aff9499542d9', '4a526a27-b6bb-449f-ae8e-77b9c6b72e49', 'ng/mg', 'male', NULL, NULL, 10.0, 80.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('0973b9ab-3856-425a-86da-003534ff8dab', '8ef00744-9709-422c-b0ed-26cdcf169487', 'ng/mg', 'female', NULL, NULL, 200.0, 2200.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('390febfc-2c88-47e8-9885-10d9f6eda2fb', '8ef00744-9709-422c-b0ed-26cdcf169487', 'ng/mg', 'male', NULL, NULL, 500.0, 3500.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('5fe0dc6f-131a-4148-a104-7e5b94704f1d', '5d2de796-6165-46c1-a870-4605c83385ec', 'ng/mg', 'female', NULL, NULL, 200.0, 2000.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('6a122136-8d2d-4610-9e53-71d8613f9a4a', '5d2de796-6165-46c1-a870-4605c83385ec', 'ng/mg', 'male', NULL, NULL, 400.0, 3000.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d2134248-711e-4b29-8712-9c107698c335', '066042e0-da25-4537-928f-3284062ffc06', 'ng/mg', 'female', NULL, NULL, 5.0, 60.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('cd0442c4-e220-476f-b277-88f1fbea4f7a', '066042e0-da25-4537-928f-3284062ffc06', 'ng/mg', 'male', NULL, NULL, 20.0, 200.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('94e2645d-52c3-4f1a-a5b8-44f99f423999', 'bb1bf920-55a5-4abc-a1a5-6a2d4e008cde', 'ng/mg', 'female', NULL, NULL, 50.0, 500.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('f1173259-e781-4ced-8595-3c6b2731030d', 'bb1bf920-55a5-4abc-a1a5-6a2d4e008cde', 'ng/mg', 'male', NULL, NULL, 100.0, 800.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('875ae1bf-500c-47ad-9f55-cee52500217d', '7ca5c534-61e6-4562-a97a-c63b938274a3', 'ng/mg', 'female', NULL, NULL, 1.0, 10.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d288c698-5434-4b1d-9615-7bf9c1052bd2', '7ca5c534-61e6-4562-a97a-c63b938274a3', 'ng/mg', 'male', NULL, NULL, 5.0, 50.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('27c95a11-ff89-48f7-820b-3b0c4cf5306a', 'b353cf8c-4831-435f-a7df-83c438d8a635', 'ng/mg', 'female', NULL, NULL, 10.0, 100.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'postmenopausal', NULL, NULL, NULL),
	('3427589d-68e5-4e53-ad1c-233be323ebb7', 'b353cf8c-4831-435f-a7df-83c438d8a635', 'ng/mg', 'male', NULL, NULL, 20.0, 175.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('bedf8308-fa5f-4514-badc-446a745917d2', '66a82131-c556-41f6-8a4d-0cb0e450e4da', 'ng/mg', 'female', NULL, NULL, 50.0, 400.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', 'follicular', NULL, NULL, NULL),
	('f15d9761-ed93-4ab3-8b5a-1beaa0d7f3d7', '66a82131-c556-41f6-8a4d-0cb0e450e4da', 'ng/mg', 'male', NULL, NULL, 40.0, 350.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('3dc44375-945f-49ad-9469-78a2a4dd0674', '2fa69078-961a-4cc0-b68c-ff858a67e697', 'ug/mg', 'female', NULL, NULL, 0.02, 0.20, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('33ce7efe-a978-44cb-aa3c-3ea689764999', '2fa69078-961a-4cc0-b68c-ff858a67e697', 'ug/mg', 'male', NULL, NULL, 0.04, 0.35, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('382762a9-93ca-479e-9091-ee46d4d8ee72', '3980cf36-7dec-445d-8d6b-010501aae378', 'ng/mg', 'general', NULL, NULL, 30.0, 180.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('520ede9c-1294-4844-8d75-c657f5312522', '96bcef08-6c8b-44cd-a30f-a166531d1747', 'ng/mg', 'general', NULL, NULL, 40.0, 220.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('644b082e-2470-4a36-9718-10b027e1a653', '2b7bdfaa-38e1-4440-8028-34ac2cd405aa', 'ng/mg', 'female', NULL, NULL, 100.0, 800.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('ac7b1438-94b0-49ec-a784-a48251f93f48', '2b7bdfaa-38e1-4440-8028-34ac2cd405aa', 'ng/mg', 'male', NULL, NULL, 150.0, 1200.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('9bf66f78-34b1-4580-8d28-36c0cc03d820', 'b771baf8-1155-44d8-b36b-a0b2038c025f', 'ng/mg', 'female', NULL, NULL, 200.0, 1500.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('1606485f-c420-409b-b607-e718a888e8e5', 'b771baf8-1155-44d8-b36b-a0b2038c025f', 'ng/mg', 'male', NULL, NULL, 300.0, 2000.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('6f7c7789-5392-4615-9b95-bfdd14e428c3', 'de54c880-4560-46cb-88a2-439743c36edc', 'ng/mg', 'female', NULL, NULL, 500.0, 3500.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('76aa9e05-de6b-4732-adec-931cfedc509d', 'de54c880-4560-46cb-88a2-439743c36edc', 'ng/mg', 'male', NULL, NULL, 700.0, 4500.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('96749bf3-66f3-462f-8581-f41587a7d47e', '7647b783-5d41-4ffd-9c2d-54d1067ae08d', 'ug/g', 'general', NULL, NULL, 1.5, 6.5, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('26807ded-42b6-4fe4-8a1f-80e75a440876', 'e1dde187-7236-4318-8de1-9e7bf3fde5ec', 'ug/g', 'general', NULL, NULL, 1.0, 4.5, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('d39a307e-bf40-467e-adc3-8e96aecf2135', '613da781-cd6f-4d53-84f7-48277ab0c3df', 'ug/g', 'general', NULL, NULL, 0.5, 3.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('7648fca5-da0e-4ef1-9305-da339bbd80a8', '36a166f6-e2a9-4e59-860d-a2266a5686db', 'ug/g', 'general', NULL, NULL, 1.0, 5.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('e5cb95f5-3d1e-4f26-b521-a09a773e85a1', '64992e6e-296a-456f-a834-b9276468ec55', 'ug/g', 'general', NULL, NULL, 0.5, 3.5, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('26d47593-fc2e-44fd-a488-bfd8e81c0b68', 'e46c4ef3-61d1-4f76-be13-8456207ff176', 'ug/g', 'general', NULL, NULL, 0.2, 2.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('05ba459c-c72a-49c3-a060-53977f2f8777', '69128082-ca7d-4676-9d0c-1c7829648237', 'ug/g', 'general', NULL, NULL, 15.0, 80.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('51e86438-bbf2-4d3e-a6a2-0336f3fd423f', '193c7e6d-fac2-4291-ba02-c68f959fe097', 'ug/g', 'general', NULL, NULL, 3.0, 20.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('f0621d58-3440-415c-9e49-c4e5ab0b35a1', 'f3873efb-2cc2-43df-bae2-dde476947a0b', 'mg/L', 'general', NULL, NULL, 0.0, 20.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('a85d5c6d-9986-4bb3-a3e8-f526f44e6615', '4a95263c-51ea-43b6-82e3-15075debeaac', 'ng/mg', 'general', NULL, NULL, 3.0, 20.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('c76da0bd-056b-4dd5-99b2-b926e9f7b56a', '60408338-63ee-433d-a24b-08452ffe441c', 'ng/mg', 'general', NULL, NULL, 10.0, 60.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL),
	('96d4bb8f-ee22-4567-965d-d0c69e7ef73d', '87a767ea-8114-42d5-9065-be27fce59296', 'mg/dL', 'general', NULL, NULL, 20.0, 250.0, 'dutch-sample-report', '2026-04-06 10:10:37.806208+00', 'normal', NULL, NULL, NULL, NULL);


--
-- Data for Name: dutch_test_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: food_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: genetic_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: impersonation_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: test_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: interpretations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: labs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lab_favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lab_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lab_test_biomarkers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: loinc_terms; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: loinc_display; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: marker_suggestions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: medical_conditions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: microbiome_taxa; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."microbiome_taxa" ("id", "name", "rank", "parent_id", "aliases", "category", "description", "created_at") VALUES
	('5148d623-4f4e-445d-a7ce-ad34dafa7236', 'Actinobacteria', 'phylum', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('b7c2de0c-8cc3-4ef8-8a8a-86bb219bbdd6', 'Bacteroidetes', 'phylum', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('1c46de13-7249-4511-ad51-6a820ba3fa2b', 'Firmicutes', 'phylum', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('808e65b3-f08e-4a43-ad33-bc0fbf0a2523', 'Fusobacteria', 'phylum', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('6c4634d3-8de1-40ae-a4a3-a4a4b2d4841d', 'Proteobacteria', 'phylum', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('b0f2563f-f991-4c9d-8052-0fd519454bfb', 'Verrucomicrobia', 'phylum', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('7eb9e5f6-c7cf-4a19-97d2-bfb843dee161', 'Bifidobacterium', 'genus', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('9b35ea54-1072-4967-bb2c-3fd052f476eb', 'Bacteroides', 'genus', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('f13d2669-d561-43a8-8a21-dba3eef46a57', 'Prevotella', 'genus', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('b7526ecb-4e40-442e-9631-a304ba9b3236', 'Prevotella copri', 'species', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('ec822cc4-f407-4f9d-b5ff-36fdb453a37b', 'Faecalibacterium prausnitzii', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('9c67a74d-afaa-43ef-a143-fdc7aa0f3c65', 'Eubacterium rectale', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('af2565db-edb2-4096-9ac2-f4225f2d37d6', 'Eubacterium hallii', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('c9a3622e-6604-4cc8-96e1-76c124cbc511', 'Roseburia spp.', 'genus', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('8e5c6bba-b459-46e0-9140-1492a0302c82', 'Ruminococcus spp.', 'genus', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('ea8a44d5-0873-4d77-8106-8cd8ff2ed1d0', 'Coprococcus spp.', 'genus', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('218fe2ba-521d-40e8-9ac9-d17b308ca1e1', 'Butyrivibrio spp.', 'genus', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('9eff7edc-1669-465d-96f0-2e4b82d82d4b', 'Christensenellaceae', 'family', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('85d127dd-6d02-4980-8097-45841f737d2e', 'Dialister invisus', 'species', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('59483fac-4ca9-44e6-9a50-45a00ff5bcd9', 'Clostridium butyricum', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('a415de1b-d5a4-4838-962c-a3fbfe09172b', 'Akkermansia muciniphila', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('5abd176a-9397-4af4-bdbe-5143b4198adc', 'Fusobacterium', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('397ebaf2-7cb0-4b2d-bdf8-3deed5ff9f64', 'Haemophilus spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('32fd76ce-f0df-4bb1-8a5a-04e9e00494ba', 'Acinetobacter spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('dc63efec-0b89-4ddf-8844-0895a5fa9ece', 'Proteus spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('8cd46248-e1ad-437a-8de7-1cb44caa7171', 'Klebsiella spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('cbd3fe38-f03d-46ad-9a6f-db082713291b', 'Enterobacter spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('3ba424eb-b069-497e-b066-1bdb9dceff02', 'Serratia spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('5076bfc4-9483-4371-90c5-2c09204b7269', 'Hafnia spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('aa4d2333-2545-4e0d-aca9-a0c5fa0e8162', 'Morganella spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('fb05c16e-3a69-4f73-89f6-48fab7f053df', 'Citrobacter spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('7e441253-78ae-46a1-b694-7081b9251691', 'Pseudomonas spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('bac1cbfa-ab31-4e1f-88f3-6abdb25d2029', 'Providencia spp.', 'genus', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('de360270-d300-4068-92f5-f65fd7ae5148', 'Desulfovibrio piger', 'species', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('9a62713c-9056-4832-a789-371929a7bbc5', 'Desulfomonas pigra', 'species', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('76195ae5-13ef-4275-bb03-4844a9d645aa', 'Bilophila wadsworthia', 'species', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('a1ac84bb-6f3f-44ca-ab68-341c3ffaacb9', 'Oxalobacter formigenes', 'species', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('7bc0cd78-7f67-4755-ac36-c6c48a36e2f1', 'Escherichia coli', 'species', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('2770c35b-92c1-488e-9d89-2d663e8d6809', 'Enterococcus spp.', 'genus', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('18b0252b-1770-4178-9253-7e4578305d1d', 'Lactobacillus spp.', 'genus', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('62217ede-6dfd-42ee-821c-39ab7658875c', 'Methanobrevibacter spp.', 'genus', NULL, '{}', 'commensal', NULL, '2026-05-20 04:32:50.620401+00'),
	('9b1d1ed1-bab7-442f-b043-d76f4930b191', 'Clostridium histolyticum', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('db8eb189-9cab-45d3-b3e2-bc7d02a48d68', 'Clostridium perfringens', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('18fc6344-529d-46e2-8a8b-d6cee91f4bf1', 'Clostridium sporogenes', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('d1186da8-f74f-48f5-8af6-27db686302b8', 'Butyraatproducerende bacteriën (totaal)', 'functional_group', NULL, '{}', 'beneficial', NULL, '2026-05-20 04:32:50.620401+00'),
	('e5c5e995-f5bb-41da-a6fd-04eabc7beeb5', 'Clostridia (totaal kiemgetal)', 'functional_group', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('260b6359-6bcf-4e79-b991-c746130343c8', 'Clostridia Cluster I', 'functional_group', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('ccb52790-cd2f-48af-a607-da187928c56b', 'Sulfaatreducerende bacteriën (SRB)', 'functional_group', NULL, '{}', 'opportunistic', NULL, '2026-05-20 04:32:50.620401+00'),
	('63ee0235-a667-45e2-86a7-765210d4996a', 'Candida albicans', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('3ca92685-7242-4ce9-a1f3-dfbaf757c106', 'Candida krusei', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('24b9b807-e9f9-4829-b240-8fa7c74f49c2', 'Candida glabrata', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('bee5a1f7-fd40-47c1-8ed9-e87f56e78efa', 'Candida dubliniensis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('b766ff53-ec54-4294-8f99-97c7048bb95f', 'Candida parapsilosis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('3d29f0ec-5b19-484a-8a45-2414585ae13d', 'Candida tropicalis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('4962038f-bc8d-4e71-8919-3c2f0127b8ae', 'Candida lusitaniae', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('af38121e-868a-4d52-8d87-29963b39f517', 'Blastocystis hominis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('f72cd6f7-7b28-45ac-929c-537e011fbf87', 'Dientamoeba fragilis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('9f3771f0-8a85-43d2-96e5-ac6819bce6a8', 'Giardia lamblia', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('f5eeed1f-c081-4902-929f-7fe236f150df', 'Entamoeba histolytica', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('a13a89df-6834-4968-bfb4-0935016140e0', 'Cryptosporidium spp.', 'genus', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('fa5cf78d-513a-48d4-a911-ebadc3a575b4', 'Cyclospora cayetanensis', 'species', NULL, '{}', 'pathogenic', NULL, '2026-05-20 04:32:50.620401+00'),
	('0bd928ce-785b-4266-820f-7e1042fb6c66', 'Butyrate-producing bacteria (total)', 'functional_group', NULL, '{}', 'beneficial', NULL, '2026-05-20 09:50:42.887308+00'),
	('d10ba916-4f84-440b-96da-cfc3eb724921', 'Clostridia (total)', 'class', NULL, '{}', 'opportunistic', NULL, '2026-05-20 09:50:42.887308+00'),
	('ce6a0d1a-e0c7-4b10-87f2-7ea111e6192c', 'Clostridia Cluster I', 'class', NULL, '{}', 'opportunistic', NULL, '2026-05-20 09:50:42.887308+00'),
	('5cb3a6b7-096c-4fc1-a701-970c21add9fb', 'Sulfate-reducing bacteria (SRB)', 'functional_group', NULL, '{}', 'commensal', NULL, '2026-05-20 09:50:42.887308+00');


--
-- Data for Name: microbiome_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: microbiome_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: microbiome_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: nevo_foods; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: next_to_test_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: next_to_test; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: other_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: other_test_values; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reference_ranges; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."reference_ranges" ("id", "biomarker_id", "unit", "sex", "age_min", "age_max", "range_low", "range_high", "source", "created_at", "range_type", "phase", "source_url", "verified_at", "verified_by") VALUES
	('ea8dae08-5ae3-41eb-aac7-c894dc2f9671', '432a7bcc-c736-4bce-960d-19e68d6a15fe', 'mg/dL', 'general', NULL, NULL, 125, 200, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f1136e16-9d54-493c-b254-6148edadff0c', 'accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', 'mg/dL', 'general', NULL, NULL, 0, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('fef4fd9b-7b07-4273-9bb7-bb80dbbb2363', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', 'general', NULL, NULL, 40, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c6b2494c-a986-4e2c-be3f-109a9c05cc63', '829a92af-7069-44a2-a79a-e01c2f7abb2c', 'mg/dL', 'general', NULL, NULL, 0, 150, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('74c25a96-cc5f-49fe-87df-e2751085dca7', '98cb6012-6568-4f8d-86ba-75862d11e766', 'mg/dL', 'general', NULL, NULL, 2, 30, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('22305c97-2822-4142-986f-489552a103d7', '1e6e9873-a41d-495c-93f0-9eba4f7eacb6', 'ratio', 'general', NULL, NULL, 0, 3.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('3a64e358-f04a-416f-ba3e-60c6c9dccab9', 'c59c5228-d5d5-4a70-806e-70170982b135', 'mg/dL', 'general', NULL, NULL, 70, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f052b3ad-eb3e-45eb-8180-9ed24ddd2139', '216dd455-f0ea-4337-9607-ceaf1bf806dd', '%', 'general', NULL, NULL, 4.0, 5.6, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('679b3a4b-19de-474a-a813-d320f8093cd0', 'f269ef8f-3b2d-444c-b26a-03b45d082b94', 'uIU/mL', 'general', NULL, NULL, 2.6, 24.9, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('fbd15957-af30-4432-97e6-2dbb92603888', '2eff0519-c47b-44ed-b605-a698e1f47dbc', 'index', 'general', NULL, NULL, 0, 2.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('741fd62d-bde4-4692-8b4a-4e95f4c1432f', '8946d072-a3f0-4227-bfca-f749c031781b', 'ng/mL', 'general', NULL, NULL, 0.8, 3.1, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6418ea64-c2e9-4102-935e-fe13ea4e8766', '3ba846a9-a038-44c4-b70c-f4f7f994d68c', 'U/L', 'general', NULL, NULL, 7, 56, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('0dcc344a-f4c4-4786-b8ac-ca638e479d2a', 'bc96eedf-8e6c-4a97-940b-8585412f95b0', 'U/L', 'general', NULL, NULL, 10, 40, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('955efa28-3ddd-4262-aa47-0d530f4c82b3', '355ce86b-8434-4e00-8974-8cbdfec20dcb', 'U/L', 'general', NULL, NULL, 9, 48, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('d4aa9d9e-b35f-4243-bc77-9daeb79d427e', '22f611f9-40ef-4c65-9001-cb26eaf2f8ec', 'U/L', 'general', NULL, NULL, 44, 147, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6a1489c7-1f1e-48d7-869f-4288915d6048', '7f631e62-f5aa-43e7-978e-6ca98d43ee71', 'g/dL', 'general', NULL, NULL, 3.4, 5.4, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('a1196340-559c-4615-ae4b-932e99f9cbe9', 'e8941ddf-d7fb-4401-9bcc-852ebfeda0df', 'mg/dL', 'general', NULL, NULL, 0.1, 1.2, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('a713dedc-6d11-48ac-86bc-bfba00994c45', '666352d2-5792-46d9-b952-708d653133a9', 'mg/dL', 'general', NULL, NULL, 0.0, 0.3, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6296c9b5-bc7d-4c0c-bc64-3c2a727228d2', '573cfaa7-cc86-49fd-958f-4c421840635d', 'mg/dL', 'general', NULL, NULL, 0.7, 1.3, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('7b824c0c-f4c5-4b91-8264-e9478dbc8f15', '191fce1e-4049-4719-9b21-5c0048e7512a', 'mg/dL', 'general', NULL, NULL, 6, 20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('d9537fb2-8d81-45fb-b766-49c9845a9058', 'ea192bf4-d73d-4be5-a6f7-7085c54dd628', 'mL/min/1.73m2', 'general', NULL, NULL, 90, 999, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('b42fd29c-506c-4f20-bd62-404198ff322a', '6c7e3e16-377b-498c-8137-0c518f5536fb', 'mg/L', 'general', NULL, NULL, 0.53, 0.95, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6b5c3668-567f-42f5-8a83-d49c89d9abc4', '79d7d5c7-d7c8-46c4-a8e4-3fbe627f3a9e', 'ratio', 'general', NULL, NULL, 10, 20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('720cdc72-f3a5-4a94-925d-15cc9de45743', '1e8ad3b0-69d9-4d44-bf59-ec222dd278db', 'mIU/L', 'general', NULL, NULL, 0.27, 4.2, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6eb4ba6b-a3d5-41aa-8c2d-f65bb5fa299a', 'c26c416c-0143-4a94-b94e-28ab0735119f', 'IU/mL', 'general', NULL, NULL, 0, 34, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('30eafa8e-6b72-43e8-9e91-33a18a1c1688', 'c5e3a987-e8cb-46e2-97e7-79d75445aa72', 'pg/mL', 'general', NULL, NULL, 2.0, 4.4, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('ffdc702b-bf17-4827-af47-a7d86a1d41e5', '4050a09d-8aa0-411f-8df9-be15222e8f11', 'ng/dL', 'general', NULL, NULL, 71, 180, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('bd47a402-f90c-40f4-9f65-4319f2711da0', '814520f7-892c-4b7d-955f-e87cfeefb28b', 'ng/dL', 'general', NULL, NULL, 0.93, 1.7, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('65592546-d726-468d-bfb5-dbc5f23eed91', 'da1e8419-a0e5-4ed4-b3a6-a961d97149c6', 'ug/dL', 'general', NULL, NULL, 4.5, 12.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('a549b78e-ba53-4cc8-9cde-a448cf29d679', '72b88cba-d849-4ee7-a4f0-8a198cf24408', 'x10^3/uL', 'general', NULL, NULL, 4.5, 11.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('724b1177-bb90-4172-a1d7-18dbcdacbe73', '3a33d3a0-a1b6-48fe-832e-737a98e1eb68', 'x10^6/uL', 'general', NULL, NULL, 4.0, 5.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c4fb02e1-0d77-4446-a660-698307fb6d2d', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', 'general', NULL, NULL, 12.0, 17.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('0fc16610-b863-41a6-beec-cf3afb0d5513', '9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', '%', 'general', NULL, NULL, 36, 52, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('7dea378d-8df8-45a2-8da3-354fecf872da', '3e2b80bf-c4dc-4bf4-a008-b2dbc5291480', 'fL', 'general', NULL, NULL, 80, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6f49c1e9-5702-4a15-9f90-cc223ba2431b', '33d595ad-91a6-4f7c-99b2-156a44fe0d21', 'pg', 'general', NULL, NULL, 27, 33, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1d3631c4-a0d2-4119-82e9-63caa970b0bd', 'b113d56f-95a6-4da0-a83b-d13b563ac83c', 'g/dL', 'general', NULL, NULL, 31.5, 35.7, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('b7c5148d-b58c-4c09-b459-06e662433f2b', '183533e4-a28c-4741-b46c-328aaeb1f1c2', 'x10^3/uL', 'general', NULL, NULL, 150, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('0e438146-c7b7-4f6e-b49c-9f3c3eeeed1f', 'afd349f5-9795-4b8d-970f-681d17239e3c', '%', 'general', NULL, NULL, 40, 70, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1b644aa2-85b5-413a-81d4-19fa842770bc', '7747eb00-64f2-4326-b2ed-708c4268d14c', '%', 'general', NULL, NULL, 20, 40, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('2e701bc9-c360-4d97-a1a2-e435143453e3', '0ae5b34d-ba7a-4b93-9232-3f08e10bd01a', '%', 'general', NULL, NULL, 2, 8, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f45a82ae-7003-4377-bc01-65377b404bb5', 'ee2459d7-bec7-4c27-9487-c8864ebe5e79', '%', 'general', NULL, NULL, 1, 4, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('8e25de48-be67-4d01-8ed5-03d061889e37', 'e2f8a4bb-f9d3-4015-99a3-2e92dd7dcf89', '%', 'general', NULL, NULL, 0, 1, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('bcd6defa-a054-4da4-b9de-d2331830e62b', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'ug/dL', 'general', NULL, NULL, 60, 170, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('678d1126-66bc-4c99-90a2-983441a6b094', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', 'general', NULL, NULL, 12, 300, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1abfffbe-8bc2-4a83-a62e-7dc7024f14c6', 'dfa1976d-d5fb-4edf-89d8-65ec5a08d24f', 'ug/dL', 'general', NULL, NULL, 250, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('01c50f46-e3ad-43f3-86ea-ecd60f549d29', 'da237a49-9617-43d5-9e7a-eb2397d51930', '%', 'general', NULL, NULL, 20, 50, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('67eb6e09-7286-4236-86d4-15ea91efcfd1', '81f6fe68-a414-4dce-83d7-1302c118ff9f', 'ng/mL', 'general', NULL, NULL, 30, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('5c478b89-2760-4b9c-ae58-a158764b3998', '4ebcc5e1-4412-49e7-852d-c0da36e82217', 'pg/mL', 'general', NULL, NULL, 200, 900, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('8a5c841e-91a8-49b3-a4c6-6575f740baea', 'e58eb066-b200-44c4-a169-c110050b8993', 'ng/mL', 'general', NULL, NULL, 2.7, 17.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('e31645cf-e9cc-49b0-940a-093d574de1e0', 'c30dc184-6d2e-4c1c-a325-b209752706e0', 'ng/mL', 'general', NULL, NULL, 5.0, 50.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('87f6c8b4-abfc-4fc9-8150-9994b7aaf56e', '19caacbd-21f8-419c-8d8e-9e382350f66d', 'ug/dL', 'general', NULL, NULL, 38, 98, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c6cf7bf1-aefe-4fce-81f2-c850e4681869', 'a0095d05-82fa-46dc-b6f5-0e15fbed1a22', 'mg/L', 'general', NULL, NULL, 5.5, 17.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('53f1c661-40af-4f2a-ae97-f68cb4bcb18d', 'f3933a85-57ad-495d-bd02-f81216189665', 'nmol/L', 'general', NULL, NULL, 70, 180, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('710f03a7-73e5-4708-90c5-55e0e68f8cd8', 'b116af7b-d1b4-4218-ba0c-c54afd82a620', 'mg/dL', 'general', NULL, NULL, 1.7, 2.2, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('28728363-cf8f-4f8d-a892-61e336db1ea3', '403cee3f-1575-4a75-8c22-90be788d5e5f', 'ug/dL', 'general', NULL, NULL, 60, 120, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('5d5ded26-3d78-4fe4-8b7a-64e3cf4fcce1', 'd9c45588-2735-4a11-8331-1bc26ad710af', 'mg/dL', 'general', NULL, NULL, 8.6, 10.2, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('673255b5-8697-4d13-86ad-a90190f9135e', 'd6a11311-df16-4548-a344-6640d688d511', 'mg/dL', 'general', NULL, NULL, 2.5, 4.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f340bd51-a771-40e6-bb55-df1b19bc7d7f', '1d228032-6e7d-48ae-8a9d-f849c702b954', 'ng/dL', 'general', NULL, NULL, 15, 1000, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('d8f59ead-8f9e-4cb6-8ed0-376aa83335d5', 'd60fdd91-2128-443f-9385-8d6be8b604f9', 'pg/mL', 'general', NULL, NULL, 0.3, 30, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('38b0d701-897a-433f-8ffc-d33511be848b', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'pg/mL', 'general', NULL, NULL, 10, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('16e6534b-55ca-4a4e-9e24-2da4c8097d76', '9db5003c-a571-4d2e-871a-0729b3c0f769', 'ng/mL', 'general', NULL, NULL, 0.1, 25.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('58ba7297-1174-43d8-a7a5-e2f2287be4ba', 'f57e5dfb-866b-4df2-b571-b2d17eca1896', 'mIU/mL', 'general', NULL, NULL, 1.0, 95.6, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4ff7fef9-e8ee-4d0a-a44b-9f541a5de6bb', '44275c87-03aa-4b77-b736-cc5d68880ce4', 'mIU/mL', 'general', NULL, NULL, 1.0, 134.8, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('d0069865-dcf9-4ab8-acaf-ca2743e6b491', '0b68518d-f31d-4586-b13c-3b7f9d90c833', 'nmol/L', 'general', NULL, NULL, 10, 130, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4ce7c97e-4f7d-45bb-bfc4-c88d658facc2', '9e979e68-51a5-4153-a14c-a060a78db4d1', 'ng/mL', 'general', NULL, NULL, 2, 29, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('07128175-a7ea-493f-a6f7-318332084847', 'd33003ee-2ccd-489a-bdff-2bad14c5631d', 'ug/dL', 'general', NULL, NULL, 6.2, 19.4, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('ed7f6440-8488-4fa8-bdaa-204e65d8a302', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'umol/L', 'general', NULL, NULL, 0.95, 15.20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6f7b99d3-4a92-41c6-885c-8f5a37dd19b1', 'c1ecae4e-6b1b-4b32-a5f9-c6ebfe8240ef', 'mg/L', 'general', NULL, NULL, 0, 3.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('5405942b-725f-4ebc-ab11-5e057792b6fb', '86fac295-50fc-470d-92ce-6ab64766a7ba', 'mm/hr', 'general', NULL, NULL, 0, 20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('9a3c03be-84e2-47de-a708-02988175029a', '78c24a5d-b909-4e85-86c9-60ae7eca06a9', 'mg/dL', 'general', NULL, NULL, 200, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('ecd0d977-8516-49e4-aa20-209f11f8f004', '3885e9a3-d5df-4396-9355-33e33a56fe07', 'pg/mL', 'general', NULL, NULL, 0, 7.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('03bcaf59-8121-4322-bea4-c1f80bb18ef8', 'd766f973-be93-4d3f-b770-4d367b1c6792', 'pg/mL', 'general', NULL, NULL, 0, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6a3a4daf-b54d-4179-afbd-58feac3ac8ba', '21d8f34c-7136-45bc-a14b-5324eb054f0f', 'ng/mL', 'general', NULL, NULL, 0, 0.04, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c60bc8d4-193f-4061-af1d-6aed77799379', '98a709e6-bb1c-4c08-9609-785a25d28f5c', 'nmol/L', 'general', NULL, NULL, 0, 1000, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('b2c4835c-0104-4bf0-8f38-356ac4ab5421', 'b1eba466-8842-4015-8af3-373f326d6794', 'nmol/L', 'general', NULL, NULL, 0, 75, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('5bbf4157-69e3-4615-b9cf-8dd0575e5697', '4c517970-d387-4deb-ad17-88f048898f30', 'mEq/L', 'general', NULL, NULL, 136, 145, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('33899ebd-2d8a-4e2d-8f5c-934fe73d2b69', '6bc7cc4c-3ff2-4ed1-bce7-b95fe3364c60', 'mEq/L', 'general', NULL, NULL, 3.5, 5.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('cbdb8c7c-395d-443a-a814-fc658644dfd0', '3a0ce50d-3630-4256-8cee-8c5fd1fe2036', 'mEq/L', 'general', NULL, NULL, 98, 106, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1e97298e-6309-4e09-b16b-100f8d88f916', 'b7a58442-fdcc-49db-9931-f37e23a57b1d', 'mEq/L', 'general', NULL, NULL, 23, 29, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('82b51298-a1e2-4c4d-aaf6-c5724f5246f8', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', 'male', NULL, NULL, 40, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f146f073-64bf-48b3-80d0-b316ffa437b3', '3ba846a9-a038-44c4-b70c-f4f7f994d68c', 'U/L', 'male', NULL, NULL, 7, 56, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4526ba81-5064-4160-8ba0-c2e6c72595f8', 'bc96eedf-8e6c-4a97-940b-8585412f95b0', 'U/L', 'male', NULL, NULL, 10, 40, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('a824d0ae-c4f9-41c9-9dad-fb0ea5abaad9', '355ce86b-8434-4e00-8974-8cbdfec20dcb', 'U/L', 'male', NULL, NULL, 12, 64, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('3b69414d-74a3-402a-9b64-8b75885141a8', '573cfaa7-cc86-49fd-958f-4c421840635d', 'mg/dL', 'male', NULL, NULL, 0.74, 1.35, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f59e4428-bb05-48c0-93c9-32b4fc9b90fd', '3a33d3a0-a1b6-48fe-832e-737a98e1eb68', 'x10^6/uL', 'male', NULL, NULL, 4.35, 5.65, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('e290cc10-45fa-4249-8eec-0b8adf35c411', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', 'male', NULL, NULL, 13.5, 17.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6cb9885c-ca82-435a-b9ff-d5a573138d48', '9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', '%', 'male', NULL, NULL, 38.3, 48.6, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('a6aed08b-239b-43ed-8e50-4cef5238ed28', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'ug/dL', 'male', NULL, NULL, 65, 175, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('402165f2-d265-45c4-94b6-02f952b3f0b4', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', 'male', NULL, NULL, 30, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('cf376a5d-f803-40fc-9a5d-469fe1c8f72c', '1d228032-6e7d-48ae-8a9d-f849c702b954', 'ng/dL', 'male', NULL, NULL, 264, 916, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('2796b38b-1c2c-4467-b513-ad152a734bd5', 'd60fdd91-2128-443f-9385-8d6be8b604f9', 'pg/mL', 'male', NULL, NULL, 8.7, 25.1, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('7ef31e00-852b-4571-8782-b347a7232562', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'pg/mL', 'male', NULL, NULL, 10, 40, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c816c351-5334-4871-8b08-78306378988e', '9db5003c-a571-4d2e-871a-0729b3c0f769', 'ng/mL', 'male', NULL, NULL, 0.1, 0.3, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4e8f656f-fbd2-403d-b3e9-3d39362e66eb', 'f57e5dfb-866b-4df2-b571-b2d17eca1896', 'mIU/mL', 'male', NULL, NULL, 1.7, 8.6, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('6d6212ef-6ca1-4b98-9e32-566f968b7f18', '44275c87-03aa-4b77-b736-cc5d68880ce4', 'mIU/mL', 'male', NULL, NULL, 1.5, 12.4, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4edae9ea-06e7-4c89-8bc1-1d2f154620a8', '0b68518d-f31d-4586-b13c-3b7f9d90c833', 'nmol/L', 'male', NULL, NULL, 10, 57, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('d26db5c2-6996-4a83-b07e-7ca45e1ba472', '9e979e68-51a5-4153-a14c-a060a78db4d1', 'ng/mL', 'male', NULL, NULL, 4, 15, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('79076899-4bd7-4856-9842-a4dd0a0c97c5', '86fac295-50fc-470d-92ce-6ab64766a7ba', 'mm/hr', 'male', NULL, NULL, 0, 15, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1d5d9a35-b201-4c55-af50-6c8656f92b4e', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', 'female', NULL, NULL, 50, 100, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('063de5ee-ea23-4df6-af36-b57a087f2d58', '3ba846a9-a038-44c4-b70c-f4f7f994d68c', 'U/L', 'female', NULL, NULL, 7, 45, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('4e92c811-eb5e-439f-a3c2-5116dc206a49', 'bc96eedf-8e6c-4a97-940b-8585412f95b0', 'U/L', 'female', NULL, NULL, 10, 35, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('ed696fac-e20b-450b-a69c-1456cf4c5fc9', '355ce86b-8434-4e00-8974-8cbdfec20dcb', 'U/L', 'female', NULL, NULL, 8, 36, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('1f58efa9-5ac8-4e56-96d4-946777590854', '573cfaa7-cc86-49fd-958f-4c421840635d', 'mg/dL', 'female', NULL, NULL, 0.59, 1.04, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('76845780-4f6c-4eab-80a1-a52b35ab92fb', '3a33d3a0-a1b6-48fe-832e-737a98e1eb68', 'x10^6/uL', 'female', NULL, NULL, 3.92, 5.13, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('cd93012f-6dfb-493b-9d77-4b1d7c2bfca6', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', 'female', NULL, NULL, 12.0, 15.5, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('7805ad9c-7b8f-4df8-b7a0-2dca97ada4ff', '9bf19a45-4b29-491e-ab5a-2bcd1a3c7686', '%', 'female', NULL, NULL, 35.5, 44.9, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('efce4be0-350d-4919-b348-ec595342996a', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'ug/dL', 'female', NULL, NULL, 50, 170, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('774ef0d0-8d9d-4cba-91e4-453344b227b7', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', 'female', NULL, NULL, 12, 150, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('e5504b90-563e-4f11-be89-38ebc2bad653', '1d228032-6e7d-48ae-8a9d-f849c702b954', 'ng/dL', 'female', NULL, NULL, 15, 70, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('b995be5e-e49d-4e36-80f9-4ca6cc08cdba', 'd60fdd91-2128-443f-9385-8d6be8b604f9', 'pg/mL', 'female', NULL, NULL, 0.3, 4.2, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('cb710db3-6236-40d6-985f-8cd266603227', '1c80d267-1e87-4e00-a4ef-3d1376e4f7a3', 'pg/mL', 'female', NULL, NULL, 15, 400, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f23a825d-86fc-4524-bc78-3159a435d8fd', '9db5003c-a571-4d2e-871a-0729b3c0f769', 'ng/mL', 'female', NULL, NULL, 0.1, 25.0, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('c5bf5581-d0ef-4b0d-9d12-769b3f5c20a9', 'f57e5dfb-866b-4df2-b571-b2d17eca1896', 'mIU/mL', 'female', NULL, NULL, 1.0, 95.6, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('493ee8d5-78b9-4b15-87ce-3c3c2cebc6ee', '44275c87-03aa-4b77-b736-cc5d68880ce4', 'mIU/mL', 'female', NULL, NULL, 1.0, 134.8, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('7fd4a644-954a-4072-bf8c-8c54e83847e9', '0b68518d-f31d-4586-b13c-3b7f9d90c833', 'nmol/L', 'female', NULL, NULL, 18, 130, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('40ed67d5-f46d-45be-8d8b-4047d204cdc6', '9e979e68-51a5-4153-a14c-a060a78db4d1', 'ng/mL', 'female', NULL, NULL, 4, 29, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('046e2f49-6153-4507-86e4-41fc52f91312', '86fac295-50fc-470d-92ce-6ab64766a7ba', 'mm/hr', 'female', NULL, NULL, 0, 20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('5e66ec27-aa6a-4377-9406-8f085f5d6216', '81f6fe68-a414-4dce-83d7-1302c118ff9f', 'ng/mL', 'general', NULL, NULL, 40, 60, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('80b419f1-f8e6-4b8c-8483-38d204678162', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', 'male', NULL, NULL, 50, 150, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('9c9c1943-22cb-4d46-8462-81ed6ee7ccff', '9a26d642-ce71-4317-8258-6ff925009471', 'ng/mL', 'female', NULL, NULL, 40, 120, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('0097dd6a-370a-4c66-993e-c92dbebc8086', '216dd455-f0ea-4337-9607-ceaf1bf806dd', '%', 'general', NULL, NULL, 4.5, 5.2, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('f2696fd8-5463-4b3c-ab78-ff7936437d90', '1e8ad3b0-69d9-4d44-bf59-ec222dd278db', 'mIU/L', 'general', NULL, NULL, 1.0, 2.5, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('eb6e042a-cde6-44fc-b071-4b53e6da4c33', 'c1ecae4e-6b1b-4b32-a5f9-c6ebfe8240ef', 'mg/L', 'general', NULL, NULL, 0, 1.0, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('2098ce18-38e1-496d-96f5-ecccf74db905', '4ebcc5e1-4412-49e7-852d-c0da36e82217', 'pg/mL', 'general', NULL, NULL, 500, 900, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('d0a1e969-9df6-4819-8fad-71faecb3f970', 'c59c5228-d5d5-4a70-806e-70170982b135', 'mg/dL', 'general', NULL, NULL, 72, 86, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('3968aebd-0865-4b82-9fb4-8d4553d3be49', 'f269ef8f-3b2d-444c-b26a-03b45d082b94', 'uIU/mL', 'general', NULL, NULL, 2, 8, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('1b12ad07-c168-479d-afbb-304bd48e0d4f', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', 'male', NULL, NULL, 14.5, 16.5, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('31a808f1-b185-45e8-8c83-b712d2bc264b', '08809836-cb1e-41d7-8307-1088b6f14c5e', 'g/dL', 'female', NULL, NULL, 13.0, 15.0, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('be753e01-d792-4899-8990-7fb7f652a001', '18ece77b-9a11-41fe-b5b5-46b3e4637523', 'ug/dL', 'general', NULL, NULL, 60, 120, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('deb0b361-f3e7-4273-b5f8-10e3f9edc371', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'umol/L', 'female', NULL, NULL, 0.95, 11.67, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('96571b2d-3c4e-4b70-8e30-f92e8b32f6d1', 'f17cefb2-587b-4ca3-90e9-8565cabec0c6', 'umol/L', 'male', NULL, NULL, 2.17, 15.20, 'seeded', '2026-03-08 08:50:58.180725+00', 'normal', NULL, NULL, NULL, NULL),
	('f401e1b9-d47f-43b4-96f0-c01aec8b5a38', '432a7bcc-c736-4bce-960d-19e68d6a15fe', 'mg/dL', 'general', NULL, NULL, 160, 200, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('a7ae6ee6-283f-41bb-8605-ce3375b80d96', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', 'male', NULL, NULL, 50, 80, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('dd541eb7-c3a1-40f0-95d4-b12a396b9f7d', 'deb52ff3-4531-47f3-b6c7-43c9558893f2', 'mg/dL', 'female', NULL, NULL, 60, 90, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('2b0ec624-55b3-4fb9-9e89-3d0ec0b1ad4c', 'accbc25a-c1eb-4cbe-b7b8-9a09d55a70a8', 'mg/dL', 'general', NULL, NULL, 50, 100, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('543b7dfc-5fe3-4684-8465-6354c91c9734', '829a92af-7069-44a2-a79a-e01c2f7abb2c', 'mg/dL', 'general', NULL, NULL, 40, 80, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('dac370df-16c0-4821-a5e1-6eb09cce7726', 'e58eb066-b200-44c4-a169-c110050b8993', 'ng/mL', 'general', NULL, NULL, 10, 25, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('a2795715-66cb-4b0f-820e-bd7225ca027a', 'b116af7b-d1b4-4218-ba0c-c54afd82a620', 'mg/dL', 'general', NULL, NULL, 2.0, 2.5, 'optimal-functional', '2026-03-08 08:50:58.180725+00', 'optimal', NULL, NULL, NULL, NULL),
	('ccdfbf9c-de6f-4ccd-91f9-f8f041ff6c94', '19bdab1d-6478-4e27-9250-d053dc67520e', '%', 'general', NULL, NULL, 11.5, 14.5, 'seeded', '2026-03-08 13:40:13.289796+00', 'normal', NULL, NULL, NULL, NULL),
	('2953ab7d-a1cc-418f-bc98-f7c5f5278878', '04816c82-cb1a-4f5d-9369-25cfab2385ab', 'µmol/L', 'general', NULL, NULL, 5, 15, 'standard-lab', '2026-05-03 14:32:04.222867+00', 'normal', NULL, NULL, NULL, NULL),
	('e88723fc-ef5f-4eb7-831a-997365e6942d', '04816c82-cb1a-4f5d-9369-25cfab2385ab', 'µmol/L', 'general', NULL, NULL, 5, 8, 'functional-medicine', '2026-05-03 14:32:04.222867+00', 'optimal', NULL, NULL, NULL, NULL);


--
-- Data for Name: rmr_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rna_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rna_expressions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: scrape_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: snp_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: supplements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: supplement_intakes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_unit_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wishlist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wishlist_sources; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Name: ai_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."ai_requests_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict RVcoc7RV6FzFYeKLR2oCFgBsBN50ZgjqUaQHRNlbWRN2qP7shM4NcvdNdv1Y3fC

-- Catalogue unit factors, from migration 20261019200000 (migrations run
-- before this seed on a fresh install, so the seed carries them too).
-- Unit conversion factors the catalogue was missing, so results entered in
-- these units can be shown in the marker's catalogue unit.
-- conversion_factor: value_in_unit × factor = value_in_catalogue_unit.
-- Idempotent: rows are matched by LOINC code and inserted only when absent.

INSERT INTO public.biomarker_units (biomarker_id, unit, is_default, conversion_factor)
SELECT b.id, f.unit, false, f.factor
FROM (VALUES
  -- monovalent ions: 1 mmol/L = 1 mEq/L
  ('1963-8',  'mmol/L',  1.0),     -- Bicarbonate
  ('2075-0',  'mmol/L',  1.0),     -- Chloride
  ('2823-3',  'mmol/L',  1.0),     -- Potassium
  ('2951-2',  'mmol/L',  1.0),     -- Sodium
  ('1975-2',  'umol/L',  0.0585),  -- Bilirubin: 1 mg/dL = 17.1 umol/L
  ('2276-4',  'pmol/L',  0.445),   -- Ferritin: 1 ng/mL = 2.247 pmol/L
  ('718-7',   'mmol/L',  1.611),   -- Hemoglobin: 1 mmol/L (Fe) = 1.611 g/dL
  ('786-4',   'mmol/L',  1.611),   -- MCHC: 1 mmol/L = 1.611 g/dL
  ('28539-5', 'fmol',    16.11),   -- MCH: 1 fmol = 16.11 pg
  ('2842-3',  'mIU/L',   0.0472),  -- Prolactin: 1 ng/mL = 21.2 mIU/L (WHO 84/500)
  ('14866-8', 'ng/L',    0.106),   -- PTH (catalogue pmol/L): 1 pmol/L = 9.43 ng/L
  ('2500-7',  'umol/L',  5.587),   -- TIBC (catalogue ug/dL): 1 umol/L = 5.587 ug/dL
  ('14800-7', 'ug/dL',   0.179),   -- TIBC (catalogue umol/L)
  ('5763-8',  'umol/L',  6.54),    -- Zinc: 1 umol/L = 6.54 ug/dL
  ('30341-2', 'mm',      1.0),     -- ESR: "mm" is the mm after one hour
  ('11054-4', 'mol/mol', 1.0),     -- LDL/HDL ratio: a ratio of two molar values
  ('3052-8',  'ng/dL',   10.0),    -- Reverse T3 (catalogue ng/L, see below)
  ('3052-8',  'pmol/L',  0.651)    -- Reverse T3: 1 ng/L = 1.536 pmol/L
) AS f(loinc, unit, factor)
JOIN public.biomarkers b ON b.loinc_code = f.loinc AND b.is_custom = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.biomarker_units bu
  WHERE bu.biomarker_id = b.id AND lower(bu.unit) = lower(f.unit)
);

-- Reverse T3 is a mass concentration (LOINC 3052-8), not a ratio. It has no
-- reference ranges, so only the catalogue unit changes.
UPDATE public.biomarkers
SET unit = 'ng/L'
WHERE loinc_code = '3052-8' AND is_custom = false AND unit = 'ratio';

INSERT INTO public.biomarker_units (biomarker_id, unit, is_default, conversion_factor)
SELECT b.id, 'ng/L', true, 1.0
FROM public.biomarkers b
WHERE b.loinc_code = '3052-8' AND b.is_custom = false
  AND NOT EXISTS (
    SELECT 1 FROM public.biomarker_units bu
    WHERE bu.biomarker_id = b.id AND lower(bu.unit) = 'ng/l'
  );


RESET ALL;
