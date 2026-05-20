// ── Types ────────────────────────────────────────────────────────────────────

export interface HrcwRow {
  apply: boolean;
  category: string;
  applicability: string;
}

export interface PersonRow {
  name: string;
  role: string;
}

export interface HazardRow {
  task: string;
  hrcw: boolean;
  hazards: string;
  initial_risk: string;
  controls: string;
  residual_risk: string;
}

export interface EmergencyProcedure {
  type: string;
  response: string;
}

export interface EmergencyContact {
  service: string;
  number: string;
}

export interface WorkerRow {
  name: string;
  quals: string;
}

export interface SwmsData {
  id: string;
  estimate_id: string;
  org_id: string;
  version: number;
  document_number: string | null;
  status: "draft" | "approved";
  s1_pc_name: string | null;
  s1_pc_contact: string | null;
  s1_works_manager: string | null;
  s1_works_manager_contact: string | null;
  s1_date_provided_to_pc: string | null;
  s1_workplace_location: string | null;
  s1_work_activity: string | null;
  s1_project_reference: string | null;
  s1_dev_responsible: string | null;
  s1_compliance_person: string | null;
  s1_compliance_measures: string | null;
  s1_reviewer: string | null;
  s1_date_received_by_reviewer: string | null;
  s1_review_triggers: string | null;
  s1_next_review_date: string | null;
  s2_hrcw: HrcwRow[];
  s3_persons: PersonRow[];
  s4_project: string | null;
  s4_pc: string | null;
  s4_activity_description: string | null;
  s4_plant_equipment: string | null;
  s4_materials: string | null;
  s4_ppe: string | null;
  s4_training: string | null;
  s4_permits: string | null;
  s4_maintenance: string | null;
  s4_legislation: string | null;
  s4_codes: string | null;
  s4_standards: string | null;
  s6_hazards: HazardRow[];
  s7_procedures: EmergencyProcedure[];
  s7_contacts: EmergencyContact[];
  s8_responsible_person: string | null;
  s8_responsible_quals: string | null;
  s8_workers: WorkerRow[];
  created_at: string;
  updated_at: string;
}

export interface OrgWorker {
  id: string;
  org_id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  sort_order: number;
}

// ── Risk rating helpers ───────────────────────────────────────────────────────

export const RISK_OPTIONS = ["H1", "H2", "M1", "M2", "M3", "L2", "L3"] as const;
export type RiskCode = (typeof RISK_OPTIONS)[number];

export const RISK_COLORS: Record<string, string> = {
  H1: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  H2: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  M1: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  M2: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  M3: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  L2: "bg-lime-500/20 text-lime-700 dark:text-lime-400 border-lime-500/30",
  L3: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
};

// ── Default HRCW classification rows ─────────────────────────────────────────

export const DEFAULT_HRCW: HrcwRow[] = [
  {
    apply: false,
    category: "Risk of a person falling more than 2 metres",
    applicability: "Not applicable — flooring scope only.",
  },
  {
    apply: false,
    category: "Work on a telecommunications tower",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Demolition of a load-bearing structure",
    applicability: "Not applicable",
  },
  {
    apply: true,
    category: "Likely to involve disturbing asbestos",
    applicability:
      "Conditional — applies only if site is known/suspected to contain ACM (pre-2003 floor finishes / vinyl backings / mastic). PC to confirm asbestos register status before commencement.",
  },
  {
    apply: false,
    category:
      "Temporary load-bearing support for structural alterations or repairs",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Work in or near a confined space",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category:
      "Work in or near a shaft or trench deeper than 1.5 m, or a tunnel",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Use of explosives",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Work on or near pressurised gas mains or piping",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Work on or near chemical, fuel or refrigerant lines",
    applicability: "Not applicable",
  },
  {
    apply: true,
    category: "Work on or near energised electrical installations or services",
    applicability:
      "Mechanical preparation (grinding, scarifying, Poly-Vac), drilling for trim/threshold fixings and screw-fixing of plywood overlay may strike concealed in-slab services in occupied / refurb spaces.",
  },
  {
    apply: true,
    category:
      "Work in an area that may have a contaminated or flammable atmosphere",
    applicability:
      "Subfloor grinding, scarifying, Poly-Vac works, feather-finish and self-leveller mixing all generate respirable crystalline silica (RCS) dust. Vinyl welding and adhesive use generate VOC / decomposition fumes.",
  },
  {
    apply: false,
    category: "Tilt-up or precast concrete elements",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category:
      "Work on, in or adjacent to a road, railway, shipping lane or other traffic corridor in use",
    applicability: "Not applicable",
  },
  {
    apply: true,
    category: "Work in an area with movement of powered mobile plant",
    applicability:
      "PC has advised that powered mobile plant (forklifts, scissor lifts, telehandlers, EWPs and delivery vehicles) will be operating on site during the flooring install window.",
  },
  {
    apply: false,
    category: "Work in areas with artificial extremes of temperature",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category:
      "Work in or near water or other liquid that involves a risk of drowning",
    applicability: "Not applicable",
  },
  {
    apply: false,
    category: "Diving work",
    applicability: "Not applicable",
  },
];

// ── Default Section 4 text fields ─────────────────────────────────────────────

export const DEFAULT_S4 = {
  activity_description:
    "Subfloor preparation (sweep, vacuum, mechanical grinding, scarifying, Poly-Vac, feather finishing, self-levelling, plywood overlay where required), installation of carpet (broadloom and/or modular tile), installation of vinyl sheet (including welded seams), installation of LVT/LVP, plus associated coving, skirting, trims and ramps.",
  plant_equipment:
    "Concrete grinder with dust extraction shroud; mechanical scarifier; Poly-Vac (multi-disc planetary surfacer); H-class HEPA vacuum; planetary mixer for self-leveller; track saw; hot-air vinyl welder; carpet seaming iron; power stretcher; knee kicker; cordless drills; circular saw; utility knives (hooked and straight blades); ELCB / RCD gang box; insulated lead stands; trolleys and roll handlers; step ladders.",
  materials:
    "Carpet (broadloom and tile); sheet vinyl; LVT / LVP; vinyl welding rod; vinyl & carpet adhesives (low-VOC where available); feather-finish / patching compound (cementitious — contains silica); self-levelling compound (cementitious — contains silica); primers; floor sealers; mechanical fixings; sealants.",
  ppe: "• Mandatory at all times: safety boots (AS/NZS 2210); hi-vis vest or shirt (AS/NZS 4602); knee pads.\n• Task-specific: safety glasses (AS/NZS 1337); hearing protection (AS/NZS 1270); P2 (P3 for prolonged) half-face respirator (AS/NZS 1716, fit-tested per AS/NZS 1715) for all silica-generating works (grinding, scarifying, Poly-Vac, feather-finish mixing/laying, self-leveller mixing) and for vinyl welding and adhesive use.\n• Cut-resistant gloves for material handling and trimming; chemical-resistant gloves for adhesive / primer use; hard hat where required by PC.",
  training:
    "General Construction Induction (White Card); SPM internal induction; site-specific induction by PC; review and acknowledgement of this SWMS and all relevant SDSs; manual-handling awareness; silica awareness training (recommended) per SafeWork NSW guidance.",
  permits:
    "• ☑ Hot Works permit — required from PC for vinyl seam welding.\n• ☑ Penetration / drilling permit — required from PC before drilling or screw-fixing into floor or subfloor where in-slab services may be present.\n• ☐ Confined Spaces — not applicable.\n• ☐ Work at Height — not applicable to flooring scope.",
  maintenance:
    "All electrical tools and equipment tested and tagged at minimum 3-monthly intervals (AS/NZS 3760) and visually inspected daily by user. RCD/ELCB protection in use at all times when on temporary power. Vinyl welder tip and rod checked at start of each shift. Damaged equipment to be tagged out and removed from service.",
  legislation:
    "Work Health and Safety Act 2011 (NSW); Work Health and Safety Regulation 2017 (NSW), including CI 291 (HRCW) and Chapter 6 (Construction Work); Protection of the Environment Operations Act 1997 (NSW).",
  codes:
    "Construction Work; Hazardous Manual Tasks; How to Manage WHS Risks; Managing Electrical Risks in the Workplace; Managing Noise and Preventing Hearing Loss at Work; Managing the Risks of Hazardous Chemicals in the Workplace; Labelling of Workplace Hazardous Chemicals; Managing the Risks of Respirable Crystalline Silica; WHS Consultation, Cooperation and Coordination.",
  standards:
    "AS 1884 (resilient flooring); AS 2455.1 / 2455.2 (textile flooring); AS/NZS 3661 (slip resistance); AS/NZS 1715/1716 (respirators); AS/NZS 1337 (eye); AS/NZS 1270 (hearing); AS/NZS 2210 (footwear); AS/NZS 3760 (test & tag).",
};

// ── Default hazard rows (Section 6) ──────────────────────────────────────────

export const DEFAULT_HAZARDS: HazardRow[] = [
  {
    task: "Site setup, access & egress",
    hrcw: false,
    hazards:
      "• Pedestrians, other trades, deliveries\n• Slip / trip / fall hazards\n• Unsecured access to work area",
    initial_risk: "M2",
    controls:
      "• Inspect access and travel paths before commencement; nominate safe pedestrian route with PC.\n• PC to provide safe access; SPM to clear our work area of debris before each shift.\n• Erect site barriers / bunting and signage where required; maintain through-job housekeeping.\n• All workers to wear safety boots and hi-vis at all times on site.",
    residual_risk: "L3",
  },
  {
    task: "Manual handling — receipt, unload and movement of carpet rolls, vinyl rolls and cementitious leveller bags",
    hrcw: false,
    hazards:
      "• Roll weight 30–80 kg; awkward shape and length\n• Manual tasks injury from repetitive lifting\n• Cement-based bag dust",
    initial_risk: "M2",
    controls:
      "• Two-person lift required for any roll > 25 kg; mechanical aids (roll trolley, sack truck, scissor lift) used where available.\n• Plan travel path before lifting; ensure destination clear; use lifts not stairs where possible.\n• Correct technique: feet apart, bend knees, back straight, load close to body, no twisting.\n• Cement-based leveller bags handled with gloves and P2 respirator; open and pour at ground level into pre-charged mixer to limit airborne dust.\n• Reference Code of Practice — Hazardous Manual Tasks.",
    residual_risk: "L3",
  },
  {
    task: "HRCW — Work in an area with movement of powered mobile plant (forklifts, scissor lifts, telehandlers, EWPs, delivery vehicles operating on site during install)",
    hrcw: true,
    hazards:
      "• Plant collision with worker — fatal/major injury\n• Plant collision with stored flooring rolls / leveller pallets\n• Pedestrian / plant interface in high-traffic zones (deliveries, lift wells, loading docks)\n• Reduced visibility around tail-swing of telehandlers and reversing forklifts\n• Spotter not present; operator blind-spots",
    initial_risk: "H1",
    controls:
      "• ELIMINATION: Where practicable, schedule SPM flooring works for periods when mobile plant is not operating in the same zone (e.g. after-hours, weekend pours, between PC plant movements). Confirm at daily pre-start with PC.\n• ISOLATION: SPM workers to keep clear of plant exclusion zones at all times; only use PC's nominated pedestrian routes; physical barriers (bunting, mesh, hard barricade) between SPM work area and plant operating area where SPM works are stationary (e.g. carpet seaming, vinyl welding).\n• ISOLATION: Where plant must enter SPM work area, plant is stopped, parked, isolated and key removed before SPM workers approach.\n• ENGINEERING: Confirm plant has functional reversing alarms, beacons and (where required by PC) proximity-detection / cameras before commencement.\n• ADMINISTRATIVE: Pre-start communication with plant operator before approaching plant; positive eye contact and operator acknowledgement before entering plant operating area; never approach plant from blind side or while plant is moving.\n• ADMINISTRATIVE: Comply with PC's site Traffic Management Plan; attend daily PC pre-start; obey speed limits, give-way rules and exclusion-zone signage.\n• ADMINISTRATIVE: No headphones / phones in use while walking on site; situational awareness maintained at all times; horseplay prohibited.\n• ADMINISTRATIVE: Stop work and notify PC immediately if plant operates inside a designated SPM exclusion zone or near-miss occurs.\n• ADMINISTRATIVE: Carpet roll, vinyl roll, leveller pallet and waste storage areas located outside plant travel paths; loading/unloading windows scheduled with PC.\n• PPE: Hi-vis vest or shirt to AS/NZS 4602.1 worn at all times on site; safety boots; hard hat where required by PC.\n• Reference Code of Practice — Construction Work and PC site rules.",
    residual_risk: "M3",
  },
  {
    task: "HRCW — Work in a contaminated atmosphere — Concrete grinding & scarifying for subfloor preparation (respirable crystalline silica)",
    hrcw: true,
    hazards:
      "• Inhalation of respirable crystalline silica (RCS) — silicosis, lung cancer, COPD\n• Dust spread to other trades / occupants\n• Noise — 85 dB(A); whole-body and hand-arm vibration\n• Electrical hazard from grinder",
    initial_risk: "H1",
    controls:
      "• ELIMINATION/SUBSTITUTION: Wet methods preferred where finish allows; consider engaging specialist sub for shot-blasting on large floors as an alternative to dry grinding.\n• ENGINEERING: Grinder fitted with on-tool dust extraction shroud connected to H-class HEPA vacuum (M-class minimum) — confirmed at pre-start. Vacuum bag changed only by operator wearing P2 respirator and disposed of when double-bagged.\n• ENGINEERING: Where dry grinding is unavoidable, establish dust exclusion zone with plastic / poly screen; mechanical ventilation where indoors and unoccupied.\n• ISOLATION: Sign and barricade exclusion zone (3 m minimum). No other trades or occupants permitted within zone during grinding.\n• ADMINISTRATIVE: Plan grinding for after-hours where occupied site; minimise duration; clean up immediately after each session — no dry sweeping (use HEPA vacuum or wet methods).\n• ADMINISTRATIVE: Health monitoring per SafeWork NSW silica guidance for workers with frequent exposure.\n• PPE: P2 minimum half-face respirator (P3 where prolonged); fit-tested per AS/NZS 1715; disposable overalls; safety glasses; hearing protection; cut-resistant gloves.\n• Reference Code of Practice — Managing the Risks of Respirable Crystalline Silica and SafeWork NSW silica information sheets.",
    residual_risk: "M3",
  },
  {
    task: "HRCW — Work in a contaminated atmosphere — Poly-Vac surfacer works on subfloor (respirable crystalline silica)",
    hrcw: true,
    hazards:
      "• Inhalation of RCS generated by multi-disc rotary surfacing of cementitious substrates\n• Re-entrainment of fine dust during disc changes and machine relocation\n• Dust spread to other trades / occupants\n• Noise and hand-arm vibration",
    initial_risk: "H1",
    controls:
      "• ELIMINATION/SUBSTITUTION: Where the finish specification allows, substitute Poly-Vac dry surfacing with wet diamond polishing or chemical surface preparation.\n• ENGINEERING: Poly-Vac to be operated only with its integrated dust extraction skirt seated on the floor and connected to a fit-for-purpose H-class HEPA vacuum (filter inspected at pre-start; airflow indicator green).\n• ENGINEERING: Disc changes, vacuum bag changes and machine relocation carried out only inside the exclusion zone with operator wearing P2 (P3 for prolonged) respirator.\n• ENGINEERING: Vacuum waste double-bagged at point of removal; sealed bags labelled 'RCS — DO NOT OPEN' and removed via licensed waste contractor.\n• ISOLATION: 3 m exclusion zone signed and barricaded; door seals / poly screens to adjacent rooms during operation; HVAC return air to the work zone isolated where occupied.\n• ADMINISTRATIVE: Schedule Poly-Vac works after hours or in vacant zones in occupied environments; brief PC and adjoining trades 24 hours in advance; daily pre-start review of dust controls and HEPA filter status.\n• ADMINISTRATIVE: No dry sweeping at any time — HEPA vacuum or damp clean only. Workers rotated to minimise individual exposure where job duration is significant.\n• ADMINISTRATIVE: Health monitoring per SafeWork NSW silica guidance for workers with frequent exposure; SDS and silica risk control reviewed at toolbox.\n• PPE: P2 minimum (P3 for prolonged) half-face respirator, fit-tested per AS/NZS 1715; disposable overalls (Type 5); safety glasses; hearing protection (AS/NZS 1270); cut-resistant gloves.\n• Reference Code of Practice — Managing the Risks of Respirable Crystalline Silica and SafeWork NSW silica information sheets.",
    residual_risk: "M3",
  },
  {
    task: "HRCW — Work in a contaminated atmosphere — Feather-finish, self-leveller and patching-compound mixing & application (respirable crystalline silica from cementitious products)",
    hrcw: true,
    hazards:
      "• Inhalation of RCS during bag opening, pouring and mixing — silicosis, lung cancer, COPD\n• Skin/eye contact — alkali burns from wet cementitious products\n• Slip hazard from spilled product",
    initial_risk: "H1",
    controls:
      "• SUBSTITUTION: Where available, specify low-silica or pre-blended low-dust feather-finish / self-leveller products; review SDS prior to ordering.\n• ENGINEERING: Open bags slowly at ground level; pour into pre-charged (water-already-in) bucket / planetary mixer to suppress dust; mix at lowest speed that achieves blend.\n• ENGINEERING: Mix outside or in a dedicated, ventilated mixing area away from other trades; HEPA vacuum near mixing point for spillage capture.\n• ISOLATION: 3 m exclusion zone during bag handling and mixing; no other trades within mixing area.\n• ADMINISTRATIVE: Limit mixing duration; rotate workers; avoid mixing concurrently with other dust-generating work in same space.\n• PPE: P2 half-face respirator (fit-tested) during bag opening, pouring and mixing; chemical-resistant gloves; safety glasses or goggles; long sleeves.\n• Spilled product cleaned with HEPA vacuum or wet rag immediately — no dry sweeping. Wash skin immediately on contact; access to wash facilities required at all times. SDS available on site.",
    residual_risk: "M3",
  },
  {
    task: "Cutting and trimming — utility (Stanley) knives, hooked-blade trimmers, carpet shears",
    hrcw: false,
    hazards:
      "• Laceration of hand, fingers, leg from blade slip\n• Eye injury from blade / off-cut fragments\n• Sharps injury from blade disposal",
    initial_risk: "M2",
    controls:
      "• Sharp blades only — replace dull blades immediately (dull blades require more force and slip more often).\n• Always cut away from body and supporting limb; one knee or foot never directly behind the cut line.\n• Cut-resistant gloves recommended for off-roll trimming; never gloves where the glove could be drawn into the blade.\n• Spent blades into a labelled sharps container; never into general waste.\n• Maintain housekeeping — off-cuts cleared as work progresses.",
    residual_risk: "L3",
  },
  {
    task: "Power-tool use — track saw, circular saw, cordless drills, hot-air vinyl welder, planetary mixer",
    hrcw: false,
    hazards:
      "• Electrical shock from damaged tool / lead\n• Burn from hot-air welder (~600 °C output) or seam iron\n• Eye / hand injury from rotating blades / bits\n• Noise > 85 dB(A) and dust",
    initial_risk: "M2",
    controls:
      "• All electrical equipment tested and tagged per AS/NZS 3760 — minimum 3-monthly; daily visual inspection by user before use.\n• RCD / ELCB protection in line at all times when on temporary or generator power.\n• Insulated lead stands / hooks used to keep leads off floor; no leads under doorways or across pedestrian routes; no daisy-chaining of power boards.\n• Hot-air welder positioned in dedicated stand when not in use; never set down on flammable material; allow to cool before storage.\n• Eye protection (AS/NZS 1337) for all sawing / drilling / cutting; hearing protection (AS/NZS 1270) where noise > 85 dB(A).\n• Damaged or unserviced equipment immediately tagged 'Do Not Operate' and removed from site.\n• Reference Code of Practice — Managing Electrical Risks in the Workplace.",
    residual_risk: "L3",
  },
  {
    task: "HRCW — Work on or near energised electrical installations or services — drilling and screw-fixing into floor / subfloor (threshold, ramp and plywood-overlay fixings) where in-slab services may be present",
    hrcw: true,
    hazards:
      "• Strike on concealed in-slab live electrical cable — electrocution / fire\n• Strike on water, gas, comms, sprinkler or hydronic-heating service in slab — flooding, asphyxiation, service outage",
    initial_risk: "H1",
    controls:
      "• Penetration / drilling permit obtained from PC before any drilling or screw-fixing into floors or subfloor where in-slab services may be present.\n• Cable / pipe locator scan completed in penetration zone before drilling; result recorded on permit.\n• Where services are confirmed or suspected, confirm isolation with PC and licensed trade before proceeding (electrical circuit de-energised and locked out / tagged out; water isolated; gas isolated by licensed gasfitter).\n• Use shortest fixings practical; do not over-drill the depth required.\n• Stop work immediately if any service is suspected; report to PC supervisor; do not attempt to repair.\n• Reference Code of Practice — Managing Electrical Risks in the Workplace and PC penetration-to-work procedure.",
    residual_risk: "M3",
  },
  {
    task: "Application of adhesives, primers, sealers and chemical floor products",
    hrcw: false,
    hazards:
      "• Inhalation of VOC fumes — headache, dizziness, respiratory irritation\n• Skin / eye irritation or sensitisation\n• Fire hazard from solvent-based products",
    initial_risk: "M2",
    controls:
      "• SUBSTITUTION: Specify and use low-VOC, water-based products wherever the manufacturer's specification allows.\n• Read SDS for every product before use; SDS folder available on site at all times; review at toolbox.\n• ENGINEERING: Mechanical ventilation where required by SDS; open doors and windows; commercial fans for solvent-based contact adhesives.\n• ISOLATION: Establish exclusion zone during application — no other trades within work area; signage at entry points.\n• Eliminate ignition sources during use of flammable adhesives; no hot work concurrent with flammable solvent application.\n• PPE: chemical-resistant gloves; P2 (P3 with organic-vapour cartridge for solvent adhesives); safety glasses; long sleeves.\n• Spill kit on hand; eye-wash available; wash hands and exposed skin immediately on contact.",
    residual_risk: "L3",
  },
  {
    task: "Hot work — vinyl seam welding (hot-air gun)",
    hrcw: false,
    hazards:
      "• Burn from hot-air gun (~600 °C) or hot weld bead\n• Inhalation of decomposition fumes from PVC vinyl\n• Fire ignition of underlying material or off-cut\n• Hot work in proximity to other trades",
    initial_risk: "M2",
    controls:
      "• Hot-work permit from PC obtained before commencement; permit posted at work area.\n• Combustibles cleared 1.5 m from work area; non-combustible underlay (e.g. silicone mat) under welder during pauses.\n• Fully charged dry-chemical fire extinguisher within arm's reach during work and for 30 minutes post completion (fire watch).\n• Mechanical ventilation in enclosed areas; P2 respirator for decomposition-fume control.\n• Heat-resistant gloves; long sleeves; eye protection.\n• Welder placed in dedicated stand when not in active use; allowed to cool before storage; cord routed to avoid trip and not across hot tip path.\n• No hot work within 24 hours of solvent / flammable adhesive application in same space.",
    residual_risk: "L3",
  },
  {
    task: "Carpet seaming — hot iron",
    hrcw: false,
    hazards: "• Burn from hot iron face\n• Skin contact with hot adhesive tape",
    initial_risk: "M2",
    controls:
      "• Iron placed in stand on non-flammable surface during pauses; never face-down on carpet pile.\n• Heat-resistant gloves recommended; ensure clear floor space around seam during pass.\n• Allow iron to fully cool before packing.",
    residual_risk: "L3",
  },
  {
    task: "Working in occupied or live environments (school terms / hospital wards / aged-care residents)",
    hrcw: false,
    hazards:
      "• Patient / resident / student injury from work activity\n• Infection-control breach in healthcare setting\n• Noise / dust impact on occupants",
    initial_risk: "M2",
    controls:
      "• Comply with PC and end-client site rules; site-specific induction completed before commencing.\n• Establish dust / noise containment screens between work zone and occupied areas.\n• Schedule grinding, scarifying, Poly-Vac and noisy works for after-hours or vacant periods where required by end client.\n• Maintain clear, signed pedestrian routes for occupants; never block fire egress.\n• In healthcare environments, follow IPC plan provided by PC / end client; ICRA risk class observed; HEPA-filtered vacuum mandatory.\n• Daily handover with end-client representative (e.g. Nurse Unit Manager, School Facilities Manager).",
    residual_risk: "L3",
  },
  {
    task: "Housekeeping, waste management and site cleanup",
    hrcw: false,
    hazards:
      "• Slip / trip from off-cuts and packaging\n• Residual chemical exposure from spent containers\n• Fire load from accumulated combustibles\n• Re-entrainment of silica dust from inadequate cleanup",
    initial_risk: "M2",
    controls:
      "• Clean as you go — no end-of-day backlog of off-cuts.\n• Spent adhesive / primer drums sealed and disposed of via licensed waste contractor per SDS.\n• Silica-bearing dust waste (grinding, Poly-Vac, leveller) double-bagged and sealed at point of generation; disposed of as RCS-contaminated waste.\n• End-of-shift inspection by SPM Site Supervisor before sign-off; HEPA vacuum used at all times — no dry sweeping.",
    residual_risk: "L3",
  },
];

// ── Default emergency procedures (Section 7) ─────────────────────────────────

export const DEFAULT_EMERGENCY_PROCEDURES: EmergencyProcedure[] = [
  {
    type: "Fire / explosion (most likely during vinyl welding or solvent-adhesive use)",
    response:
      "• STOP work and call for the PC site supervisor; if the fire cannot be safely contained with a portable fire extinguisher, evacuate.\n• Initiate the PC's emergency evacuation procedure; assemble at the nominated muster point.\n• If safe to do so, isolate the energy source (turn off welder, remove fuel sources).\n• Call 000 if fire is uncontrolled; advise PC and SPM Site Supervisor.\n• After extinguishing, monitor area for 30 minutes; do not resume hot work until area is verified safe.",
  },
  {
    type: "Mobile-plant incident (collision, near-miss, plant rollover)",
    response:
      "• STOP all SPM works in the affected area; remove SPM personnel to a safe location well clear of the plant operating zone.\n• If a worker is struck or trapped: call 000 immediately; do not move the worker unless required to prevent further injury.\n• Notify PC site supervisor and SPM Site Supervisor immediately; secure the scene and preserve evidence until PC / SafeWork NSW directs.\n• Report as a notifiable incident to SafeWork NSW (13 10 50) where criteria met.",
  },
  {
    type: "Silica dust over-exposure or inhalation event",
    response:
      "• Move affected worker to fresh air immediately; remove respirator and contaminated clothing; rinse exposed skin.\n• If respiratory symptoms (cough, breathing difficulty) seek medical attention; call 000 if severe.\n• Stop the source activity; identify control failure (e.g. failed HEPA filter, breached extraction skirt) and rectify before resuming.\n• Notify SPM Site Supervisor; record event; review controls in this SWMS before resuming work.",
  },
  {
    type: "Chemical exposure (adhesive, primer, leveller, fume from welding)",
    response:
      "• Move affected worker to fresh air immediately.\n• If skin contact: flush with copious water; remove contaminated clothing.\n• If eye contact: irrigate at eye-wash station for at least 15 minutes; do not allow worker to rub eyes.\n• If ingested or inhaled with significant symptoms: call 000 and Poisons Information Centre 13 11 26.\n• Refer to relevant SDS; provide SDS to attending paramedics; notify PC supervisor and SPM Site Supervisor.",
  },
  {
    type: "Electrical incident — shock, burn, equipment fault",
    response:
      "• Do not touch the casualty if still in contact with the source — isolate power first (turn off RCD / breaker, remove plug with insulated tool).\n• Call 000 immediately for any electric shock event regardless of apparent severity.\n• Render first aid (CPR if trained and required) until ambulance arrives.\n• Tag out faulty equipment; remove from service; do not use until tested by a licensed electrician.\n• Report as a notifiable incident to SafeWork NSW per WHS Act if criteria met.",
  },
  {
    type: "Manual-handling injury, lacerations, burns and other first-aid events",
    response:
      "• Stop activity; render first aid from on-site kit; trained first-aider attends.\n• Notify SPM Site Supervisor and PC supervisor immediately.\n• If injury exceeds first-aid scope, arrange medical attention or call 000.\n• Complete incident / near-miss report; review the relevant section of this SWMS before resuming the task.",
  },
  {
    type: "Notifiable incident reporting (WHS Act 2011 (NSW), s 35–37)",
    response:
      "• Notify SafeWork NSW on 13 10 50 immediately for: death; serious injury / illness; or dangerous incident (electrical contact, structural collapse, plant collision, gas leak, etc.).\n• Preserve the incident site so far as is reasonable until SafeWork NSW or the PC directs otherwise.\n• Notify PC supervisor and SPM Director immediately.",
  },
];

export const DEFAULT_EMERGENCY_CONTACTS: EmergencyContact[] = [
  { service: "Emergency services (Police / Fire / Ambulance)", number: "000" },
  { service: "Poisons Information Centre", number: "13 11 26" },
  { service: "SafeWork NSW (notifiable incidents)", number: "13 10 50" },
  { service: "SPM Director", number: "" },
  { service: "Project Manager", number: "" },
];
