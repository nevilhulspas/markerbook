/**
 * Curated catalog of health-relevant SNPs.
 * Used for:
 * 1. Enriching imported raw SNP data with gene names, variant names, and categories
 * 2. Filtering which SNPs to show in the UI and include in AI context
 */

export interface HealthSnpDefinition {
  rsid: string
  gene: string
  variant: string
  category: string
  riskAllele: string
  description: string
}

export const HEALTH_SNP_CATALOG: HealthSnpDefinition[] = [
  // === Methylation ===
  { rsid: 'rs1801133', gene: 'MTHFR', variant: 'C677T', category: 'Methylation', riskAllele: 'T', description: 'Associated with lower activity of a folate-processing enzyme; may relate to homocysteine levels' },
  { rsid: 'rs1801131', gene: 'MTHFR', variant: 'A1298C', category: 'Methylation', riskAllele: 'C', description: 'Associated with a modest change in folate-processing enzyme activity' },
  { rsid: 'rs1805087', gene: 'MTR', variant: 'A2756G', category: 'Methylation', riskAllele: 'G', description: 'Methionine synthase; B12 metabolism' },
  { rsid: 'rs1802059', gene: 'MTRR', variant: 'A66G', category: 'Methylation', riskAllele: 'G', description: 'Methionine synthase reductase; B12 recycling' },
  { rsid: 'rs234706', gene: 'CBS', variant: 'C699T', category: 'Methylation', riskAllele: 'T', description: 'Cystathionine beta-synthase; homocysteine pathway' },
  { rsid: 'rs4633', gene: 'COMT', variant: 'H62H', category: 'Methylation', riskAllele: 'T', description: 'Catechol-O-methyltransferase activity' },
  { rsid: 'rs4680', gene: 'COMT', variant: 'V158M', category: 'Methylation', riskAllele: 'A', description: 'Dopamine/estrogen metabolism; stress response' },
  { rsid: 'rs6323', gene: 'MAO-A', variant: 'R297R', category: 'Methylation', riskAllele: 'T', description: 'Monoamine oxidase; serotonin/dopamine breakdown' },

  // === Detoxification ===
  { rsid: 'rs1695', gene: 'GSTP1', variant: 'I105V', category: 'Detoxification', riskAllele: 'G', description: 'Glutathione S-transferase; phase II detox' },
  { rsid: 'rs1056806', gene: 'GSTM1', variant: 'C534T', category: 'Detoxification', riskAllele: 'T', description: 'Glutathione conjugation enzyme' },
  { rsid: 'rs762551', gene: 'CYP1A2', variant: '*1F', category: 'Detoxification', riskAllele: 'C', description: 'Caffeine metabolism; slow vs fast metabolizer' },
  { rsid: 'rs1799853', gene: 'CYP2C9', variant: '*2', category: 'Detoxification', riskAllele: 'T', description: 'Drug metabolism (warfarin, NSAIDs)' },
  { rsid: 'rs1057910', gene: 'CYP2C9', variant: '*3', category: 'Detoxification', riskAllele: 'C', description: 'Drug metabolism (warfarin, NSAIDs)' },
  { rsid: 'rs3892097', gene: 'CYP2D6', variant: '*4', category: 'Detoxification', riskAllele: 'A', description: 'Drug metabolism (codeine, antidepressants)' },
  { rsid: 'rs4244285', gene: 'CYP2C19', variant: '*2', category: 'Detoxification', riskAllele: 'A', description: 'Drug metabolism (clopidogrel, PPIs)' },
  { rsid: 'rs1048943', gene: 'CYP1A1', variant: 'I462V', category: 'Detoxification', riskAllele: 'G', description: 'Phase I detox; estrogen metabolism' },
  { rsid: 'rs1800566', gene: 'NQO1', variant: 'P187S', category: 'Detoxification', riskAllele: 'T', description: 'NAD(P)H quinone oxidoreductase; CoQ10 activation' },

  // === Cardiovascular ===
  { rsid: 'rs429358', gene: 'APOE', variant: 'ε4 (C112R)', category: 'Cardiovascular', riskAllele: 'C', description: 'Associated in studies with cardiovascular and Alzheimer risk' },
  { rsid: 'rs7412', gene: 'APOE', variant: 'ε2 (R158C)', category: 'Cardiovascular', riskAllele: 'T', description: 'APOE isoform determination' },
  { rsid: 'rs1799983', gene: 'NOS3', variant: 'G894T', category: 'Cardiovascular', riskAllele: 'T', description: 'Nitric oxide production; blood pressure' },
  { rsid: 'rs1800779', gene: 'NOS3', variant: 'A-922G', category: 'Cardiovascular', riskAllele: 'G', description: 'Endothelial nitric oxide synthase' },
  { rsid: 'rs5082', gene: 'APOA2', variant: '-265T>C', category: 'Cardiovascular', riskAllele: 'C', description: 'Associated with how body weight responds to saturated fat' },
  { rsid: 'rs1800588', gene: 'LIPC', variant: 'C-514T', category: 'Cardiovascular', riskAllele: 'T', description: 'Hepatic lipase; HDL cholesterol' },
  { rsid: 'rs1801282', gene: 'PPARG', variant: 'Pro12Ala', category: 'Cardiovascular', riskAllele: 'G', description: 'Associated with insulin sensitivity' },
  { rsid: 'rs1799945', gene: 'HFE', variant: 'H63D', category: 'Cardiovascular', riskAllele: 'G', description: 'Associated with iron storage; usually a small effect on its own' },
  { rsid: 'rs1800562', gene: 'HFE', variant: 'C282Y', category: 'Cardiovascular', riskAllele: 'A', description: 'Associated with iron storage (hereditary hemochromatosis)' },

  // === Vitamin & Nutrient Metabolism ===
  { rsid: 'rs12785878', gene: 'DHCR7/NADSYN1', variant: 'G>T', category: 'Nutrient Metabolism', riskAllele: 'T', description: 'Vitamin D synthesis' },
  { rsid: 'rs10741657', gene: 'CYP2R1', variant: 'G>A', category: 'Nutrient Metabolism', riskAllele: 'A', description: 'Vitamin D 25-hydroxylation' },
  { rsid: 'rs2282679', gene: 'GC', variant: 'T>G', category: 'Nutrient Metabolism', riskAllele: 'G', description: 'Vitamin D binding protein' },
  { rsid: 'rs7041', gene: 'GC', variant: 'G>T', category: 'Nutrient Metabolism', riskAllele: 'T', description: 'Vitamin D transport' },
  { rsid: 'rs602662', gene: 'FUT2', variant: 'G>A', category: 'Nutrient Metabolism', riskAllele: 'A', description: 'B12 absorption; secretor status' },
  { rsid: 'rs492602', gene: 'FUT2', variant: 'C>T', category: 'Nutrient Metabolism', riskAllele: 'T', description: 'B12 and folate absorption' },
  { rsid: 'rs855791', gene: 'TMPRSS6', variant: 'A736V', category: 'Nutrient Metabolism', riskAllele: 'T', description: 'Associated with iron absorption' },
  { rsid: 'rs1799998', gene: 'CYP11B2', variant: 'T-344C', category: 'Nutrient Metabolism', riskAllele: 'C', description: 'Aldosterone; sodium/potassium balance' },

  // === Inflammation & Immune ===
  { rsid: 'rs1800795', gene: 'IL-6', variant: 'G-174C', category: 'Inflammation', riskAllele: 'C', description: 'Interleukin-6; inflammatory response' },
  { rsid: 'rs1800629', gene: 'TNF-α', variant: 'G-308A', category: 'Inflammation', riskAllele: 'A', description: 'Tumor necrosis factor; inflammation' },
  { rsid: 'rs1143634', gene: 'IL-1β', variant: 'C3954T', category: 'Inflammation', riskAllele: 'T', description: 'Interleukin-1 beta; inflammatory response' },
  { rsid: 'rs20417', gene: 'PTGS2', variant: 'G-765C', category: 'Inflammation', riskAllele: 'C', description: 'COX-2; prostaglandin synthesis' },
  { rsid: 'rs1800896', gene: 'IL-10', variant: 'G-1082A', category: 'Inflammation', riskAllele: 'A', description: 'Anti-inflammatory cytokine' },

  // === Thyroid ===
  { rsid: 'rs225014', gene: 'DIO2', variant: 'Thr92Ala', category: 'Thyroid', riskAllele: 'T', description: 'T4 to T3 conversion; thyroid hormone activation' },
  { rsid: 'rs1991517', gene: 'DIO1', variant: 'C785T', category: 'Thyroid', riskAllele: 'T', description: 'Type 1 deiodinase; T4 to T3' },

  // === Neurotransmitters & Mental Health ===
  { rsid: 'rs6265', gene: 'BDNF', variant: 'Val66Met', category: 'Neurotransmitters', riskAllele: 'T', description: 'Brain-derived neurotrophic factor; mood & cognition' },
  { rsid: 'rs4570625', gene: 'TPH2', variant: 'G-703T', category: 'Neurotransmitters', riskAllele: 'T', description: 'Serotonin synthesis' },
  { rsid: 'rs1386494', gene: 'GAD1', variant: 'C>T', category: 'Neurotransmitters', riskAllele: 'T', description: 'GABA synthesis' },
  { rsid: 'rs165599', gene: 'COMT', variant: '3′UTR', category: 'Neurotransmitters', riskAllele: 'G', description: 'COMT expression regulation' },

  // === Histamine & Food Sensitivity ===
  { rsid: 'rs1049793', gene: 'ABP1/AOC1', variant: 'His645Asp', category: 'Histamine', riskAllele: 'G', description: 'Diamine oxidase; histamine clearance' },
  { rsid: 'rs10156191', gene: 'ABP1/AOC1', variant: 'Thr16Met', category: 'Histamine', riskAllele: 'T', description: 'DAO enzyme activity; histamine breakdown' },
  { rsid: 'rs1050891', gene: 'HNMT', variant: 'Thr105Ile', category: 'Histamine', riskAllele: 'T', description: 'Histamine N-methyltransferase; intracellular histamine' },

  // === Oxidative Stress ===
  { rsid: 'rs1001179', gene: 'CAT', variant: 'C-262T', category: 'Oxidative Stress', riskAllele: 'T', description: 'Catalase; hydrogen peroxide breakdown' },
  { rsid: 'rs4880', gene: 'SOD2', variant: 'A16V', category: 'Oxidative Stress', riskAllele: 'T', description: 'Superoxide dismutase; mitochondrial antioxidant' },
  { rsid: 'rs1050450', gene: 'GPX1', variant: 'Pro198Leu', category: 'Oxidative Stress', riskAllele: 'T', description: 'Glutathione peroxidase; selenium dependent' },

  // === Sleep & Circadian ===
  { rsid: 'rs73598374', gene: 'ADA', variant: 'Asp8Asn', category: 'Sleep', riskAllele: 'T', description: 'Adenosine deaminase; deep sleep quality' },
  { rsid: 'rs1801260', gene: 'CLOCK', variant: '3111T>C', category: 'Sleep', riskAllele: 'C', description: 'Circadian rhythm; evening preference' },

  // === Exercise & Performance ===
  { rsid: 'rs1815739', gene: 'ACTN3', variant: 'R577X', category: 'Exercise', riskAllele: 'T', description: 'Alpha-actinin-3; fast-twitch muscle fibers' },
  { rsid: 'rs8192678', gene: 'PPARGC1A', variant: 'Gly482Ser', category: 'Exercise', riskAllele: 'A', description: 'PGC-1α; endurance capacity & mitochondrial biogenesis' },
  { rsid: 'rs4994', gene: 'ADRB3', variant: 'Trp64Arg', category: 'Exercise', riskAllele: 'T', description: 'Beta-3 adrenergic receptor; fat metabolism during exercise' },

  // === Weight & Metabolism ===
  { rsid: 'rs9939609', gene: 'FTO', variant: 'T>A', category: 'Metabolism', riskAllele: 'A', description: 'Fat mass and obesity-associated; appetite regulation' },
  { rsid: 'rs1801725', gene: 'CASR', variant: 'A986S', category: 'Metabolism', riskAllele: 'T', description: 'Calcium-sensing receptor; calcium homeostasis' },
  { rsid: 'rs1042713', gene: 'ADRB2', variant: 'Arg16Gly', category: 'Metabolism', riskAllele: 'G', description: 'Beta-2 adrenergic receptor; fat breakdown' },
  { rsid: 'rs17782313', gene: 'MC4R', variant: 'T>C', category: 'Metabolism', riskAllele: 'C', description: 'Melanocortin-4 receptor; appetite and satiety signaling' },
  { rsid: 'rs174547', gene: 'FADS1', variant: 'T>C', category: 'Metabolism', riskAllele: 'T', description: 'Fatty acid desaturase; omega-3/6 conversion' },
  { rsid: 'rs1800592', gene: 'UCP1', variant: 'A>G', category: 'Metabolism', riskAllele: 'G', description: 'Uncoupling protein 1; thermogenesis and brown fat activity' },
  { rsid: 'rs7903146', gene: 'TCF7L2', variant: 'C>T', category: 'Metabolism', riskAllele: 'T', description: 'Transcription factor 7-like 2; associated with type 2 diabetes risk in studies' },
  { rsid: 'rs12255372', gene: 'TCF7L2', variant: 'G>T', category: 'Metabolism', riskAllele: 'T', description: 'TCF7L2 second variant; insulin secretion' },
  { rsid: 'rs2943634', gene: 'IRS1', variant: 'A>C', category: 'Metabolism', riskAllele: 'C', description: 'Insulin receptor substrate 1; associated with insulin sensitivity' },
  { rsid: 'rs11558471', gene: 'SLC30A8', variant: 'G>A', category: 'Metabolism', riskAllele: 'A', description: 'Zinc transporter; pancreatic beta-cell function' },
  { rsid: 'rs10830963', gene: 'MTNR1B', variant: 'C>G', category: 'Metabolism', riskAllele: 'G', description: 'Melatonin receptor 1B; associated with fasting glucose' },
  { rsid: 'rs4244372', gene: 'AMY1', variant: 'T>A', category: 'Metabolism', riskAllele: 'A', description: 'Salivary amylase; starch digestion capacity' },
  { rsid: 'rs4988235', gene: 'MCM6', variant: 'T>C', category: 'Metabolism', riskAllele: 'C', description: 'Lactase persistence; lactose tolerance/intolerance' },

  // === Neurotransmitters (additional) ===
  { rsid: 'rs1800497', gene: 'DRD2', variant: 'Taq1A', category: 'Neurotransmitters', riskAllele: 'T', description: 'Dopamine D2 receptor density; reward sensitivity' },
  { rsid: 'rs6311', gene: 'HTR2A', variant: 'A-1438G', category: 'Neurotransmitters', riskAllele: 'C', description: 'Serotonin 2A receptor; mood and SSRI response' },
  { rsid: 'rs1799971', gene: 'OPRM1', variant: 'A118G', category: 'Neurotransmitters', riskAllele: 'G', description: 'Mu-opioid receptor; pain sensitivity and reward' },
  { rsid: 'rs53576', gene: 'OXTR', variant: 'G>A', category: 'Neurotransmitters', riskAllele: 'A', description: 'Oxytocin receptor; social bonding and empathy' },
  { rsid: 'rs1049353', gene: 'CNR1', variant: 'G1359A', category: 'Neurotransmitters', riskAllele: 'A', description: 'Cannabinoid receptor 1; appetite and mood regulation' },
  { rsid: 'rs2023239', gene: 'CNR1', variant: 'C>T', category: 'Neurotransmitters', riskAllele: 'T', description: 'Cannabinoid receptor 1 second variant' },

  // === Cardiovascular (additional) ===
  { rsid: 'rs10757278', gene: '9P21', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: 'Chromosome 9p21; associated with coronary artery disease risk in studies' },
  { rsid: 'rs10757274', gene: '9P21', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: '9p21 region; associated with heart attack risk in studies' },
  { rsid: 'rs4977574', gene: '9P21', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: '9p21 region; associated with atherosclerosis in studies' },
  { rsid: 'rs599839', gene: '1P21', variant: 'G>A', category: 'Cardiovascular', riskAllele: 'A', description: 'Chromosome 1p13; LDL cholesterol levels' },
  { rsid: 'rs688', gene: 'LDLR', variant: 'C>T', category: 'Cardiovascular', riskAllele: 'T', description: 'LDL receptor; cholesterol uptake by liver' },
  { rsid: 'rs11591147', gene: 'PCSK9', variant: 'R46L', category: 'Cardiovascular', riskAllele: 'T', description: 'PCSK9 loss-of-function; lower LDL cholesterol' },
  { rsid: 'rs3812316', gene: 'MLXIPL', variant: 'Q241H', category: 'Cardiovascular', riskAllele: 'C', description: 'ChREBP; triglyceride levels' },
  { rsid: 'rs4420638', gene: 'APOE', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: 'APOE cluster; Alzheimer and lipid metabolism' },
  { rsid: 'rs4343', gene: 'ACE', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: 'Angiotensin-converting enzyme; blood pressure regulation' },
  { rsid: 'rs2070788', gene: 'TMPRSS2', variant: 'A>G', category: 'Cardiovascular', riskAllele: 'G', description: 'Transmembrane serine protease; studied in viral entry' },
  { rsid: 'rs4149056', gene: 'SLCO1B1', variant: 'V174A', category: 'Detoxification', riskAllele: 'C', description: 'Statin transporter; associated with muscle side effects of statins' },

  // === Methylation (additional) ===
  { rsid: 'rs1979277', gene: 'SHMT1', variant: 'C1420T', category: 'Methylation', riskAllele: 'A', description: 'Serine hydroxymethyltransferase; folate metabolism' },
  { rsid: 'rs601338', gene: 'FUT2', variant: 'G>A', category: 'Nutrient Metabolism', riskAllele: 'A', description: 'Fucosyltransferase 2; B12 absorption, secretor status' },
  { rsid: 'rs1801394', gene: 'MTRR', variant: 'A66G', category: 'Methylation', riskAllele: 'G', description: 'Methionine synthase reductase; B12 recycling' },

  // === Sleep (additional) ===
  { rsid: 'rs2287161', gene: 'CRY1', variant: 'G>C', category: 'Sleep', riskAllele: 'C', description: 'Cryptochrome 1; circadian rhythm and delayed sleep phase' },

  // === Vitamin D (additional) ===
  { rsid: 'rs1544410', gene: 'VDR', variant: 'BsmI', category: 'Nutrient Metabolism', riskAllele: 'A', description: 'Vitamin D receptor; bone density and immune function' },

  // === Immune / Autoimmune ===
  { rsid: 'rs2187668', gene: 'HLA-DQ2', variant: 'G>A', category: 'Immune', riskAllele: 'A', description: 'HLA-DQ2.5; associated with celiac disease (most carriers never develop it)' },
  { rsid: 'rs7454108', gene: 'HLA-DQ8', variant: 'T>C', category: 'Immune', riskAllele: 'C', description: 'HLA-DQ8; associated with celiac disease and type 1 diabetes (most carriers never develop either)' },
  { rsid: 'rs2395182', gene: 'HLA-DR', variant: 'G>T', category: 'Immune', riskAllele: 'T', description: 'HLA class II; associated with immune response variation' },
  { rsid: 'rs7775228', gene: 'HLA', variant: 'T>C', category: 'Immune', riskAllele: 'C', description: 'HLA region; immune response variation' },
  { rsid: 'rs33972313', gene: 'SLC23A1', variant: 'G>A', category: 'Nutrient Metabolism', riskAllele: 'A', description: 'Vitamin C transporter; ascorbic acid levels' },

  // === Longevity ===
  { rsid: 'rs2802292', gene: 'FOXO3', variant: 'C>A', category: 'Longevity', riskAllele: 'G', description: 'Forkhead box O3; longevity and stress resistance' },
  { rsid: 'rs3758391', gene: 'SIRT1', variant: 'T>C', category: 'Longevity', riskAllele: 'C', description: 'Sirtuin 1; cellular aging and NAD+ metabolism' },

  // === Hormones ===
  { rsid: 'rs6152', gene: 'AR', variant: 'G>A', category: 'Hormones', riskAllele: 'A', description: 'Androgen receptor; testosterone sensitivity' },
  { rsid: 'rs743572', gene: 'CYP17A1', variant: 'A>G', category: 'Hormones', riskAllele: 'G', description: 'Steroid 17α-hydroxylase; testosterone/estrogen synthesis' },
  { rsid: 'rs12150660', gene: 'SHBG', variant: 'T>G', category: 'Hormones', riskAllele: 'G', description: 'Sex hormone-binding globulin levels' },
  { rsid: 'rs6258', gene: 'SHBG', variant: 'C>T', category: 'Hormones', riskAllele: 'T', description: 'SHBG missense; free testosterone availability' },
  { rsid: 'rs523349', gene: 'SRD5A2', variant: 'V89L', category: 'Hormones', riskAllele: 'G', description: '5-alpha reductase type 2; DHT conversion' },
  { rsid: 'rs1902023', gene: 'UGT2B15', variant: 'D85Y', category: 'Hormones', riskAllele: 'T', description: 'Androgen glucuronidation; testosterone clearance' },
  { rsid: 'rs10046', gene: 'CYP19A1', variant: 'C>T', category: 'Hormones', riskAllele: 'T', description: 'Aromatase; estrogen conversion from testosterone' },
  { rsid: 'rs1048943', gene: 'CYP1A1', variant: 'I462V', category: 'Detoxification', riskAllele: 'G', description: 'Phase I detox; estrogen and toxin metabolism' },
  { rsid: 'rs1056836', gene: 'CYP1B1', variant: 'L432V', category: 'Detoxification', riskAllele: 'G', description: 'Estrogen metabolism; 4-OH estrogen pathway' },
  { rsid: 'rs2740574', gene: 'CYP3A4', variant: '*1B', category: 'Detoxification', riskAllele: 'G', description: 'Major drug-metabolizing enzyme; hormone clearance' },

  // === Detoxification (additional) ===
  { rsid: 'rs2266633', gene: 'GSTT1', variant: 'C>T', category: 'Detoxification', riskAllele: 'T', description: 'Glutathione S-transferase theta 1; phase II detox' },
]

/** Map for fast rsID lookup */
export const HEALTH_SNP_MAP = new Map(
  HEALTH_SNP_CATALOG.map((snp) => [snp.rsid, snp])
)

/** Get all unique categories */
export const HEALTH_SNP_CATEGORIES = [
  ...new Set(HEALTH_SNP_CATALOG.map((s) => s.category)),
].sort()
