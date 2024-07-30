use crate::settlement::SettleMentInfo;
use crate::state::Attributes;
use crate::state::Modifier;
use serde::Serialize;
const ENTITY_ATTRIBUTES_SIZE: usize = 6;
const LOCAL_ATTRIBUTES_SIZE: usize = 8;

#[derive(Serialize, Clone)]
pub struct Config {
    version: &'static str,
    entity_attributes: [&'static str; ENTITY_ATTRIBUTES_SIZE],
    local_attributes: [&'static str; LOCAL_ATTRIBUTES_SIZE],
    modifiers: Vec<(
        usize,
        [i64; ENTITY_ATTRIBUTES_SIZE],
        [i64; LOCAL_ATTRIBUTES_SIZE],
        &'static str,
    )>,
}
pub fn default_entities() -> [i64; ENTITY_ATTRIBUTES_SIZE] {
    [20, 0, 0, 0, 0, 0]
}

pub fn default_local() -> [i64; LOCAL_ATTRIBUTES_SIZE] {
    [30, 30, 0, 0, 2, 0, 0, 0]
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        version: "1.0",
        entity_attributes: ["Enercore", "Nexium", "Swifex", "Cognisurge", "Vitalshield", "Flexonix"],
        local_attributes: ["Engery Crystal", "Instellar Mineral", "Biomass", "Quantum Foam", "Necrodermis", "Alien Floral", "Spice Melange", "Treasure"],
        modifiers: vec![
            (2, [-10, 0, 0, 0, 0, 0], [-10, -10, 20, 0, 0, 0, 0, 0], "BioGen"),
            (4, [10, 0, 0, 0, 0, 0], [30, 0, -10, 0, 0, 0, 0, 0], "CrysTara"),
            (4, [10, 0, 0, 0, 0, 0], [0, 30, -10, 0, 0, 0, 0, 0], "AstroMine"),
            (4, [10, 0, 0, 0, 0, 0], [10, 0, -30, 0, 20, 0, 0, 0], "CrystaBloom"),
            (4, [0, 0, 10, 0, 0, 0], [-30, 0, 20, 0, -20, 0, 0, 0], "EnerGex"),
            (4, [-10, 0, 0, 0, 0, 0], [0, 0, -10, 6, 0, 0, 0, 0], "StellarCharge"),
            (4, [0, 0, 1, 0, 0, 0], [10, -10, 4, 0, -4, 0, 0, 0], "FoamTap"),
            (4, [20, -1, 0, 0, 0, 0], [-20, 0, -6, 2, 3, 0, 0, 0], "EnerFusion"),
            (4, [0, 0, 2, 0, 0, 0], [-30, 40, 18, -9, -3, 0, 0, 0], "EnerPlex"),
            (18, [-200, 0, -30, 0, 0, 0], [-80, -120, -90, -28, -30, 0, 0, 1], "TTgenesis"),
            (6, [-20, 3, -5, 0, 0, 0], [0, -40, -30, 12, -10, 0, 0, 0], "QuantaForge"),
            (10, [0, 4, 0, 0, 0, 0], [80, -40, -30, -15, -12, 0, 0, 0], "FortiFyx"),
            (16, [0, -9, -15, 0, 0, 0], [-100, -80, -40, -16, -24, 0, 0, 1], "SynTitan"),
            (20, [120, 10, -20, 10, 0, 0], [-200, 0, -60, 0, -40, 5, 0, 0], "SwiftForge"),
            (10, [60, 0, -12, 6, 0, 0], [0, -80, -50, 10, -20, 2, 0, 0], "XenoFloral"),
            (24, [-100, -12, -30, -12, 0, 0], [0, 0, 0, -60, -60, -5, 0, 2], "TitaniumBoost"),
            (30, [-100, 10, -30, 10, 0, 0], [-150, 0, -80, 0, 60, -4, 0, 0], "CerebraSpark"),
            (10, [0, 3, -10, 5, 0, 0], [-80, 0, -40, 10, -20, 2, 0, 0], "QuiFoam"),
            (12, [-40, 0, 10, -5, 0, 0], [0, 60, -30, 0, 0, -3, 1, 0], "AstroCharge"),
            (12, [100, -5, -10, 0, 0, 0], [-100, 50, -30, -20, 0, 3, 0, 0], "EnerGate"),
            (12, [100, -6, 8, 3, 0, 0], [0, -60, 50, -30, 0, -1, 0, 0], "CogniMelt"),
            (12, [0, 2, -4, -6, 0, 0], [-8, -20, 0, 2, -16, 0, 3, 0], "NexiMine"),
            (12, [-100, 0, -6, 8, 0, 0], [-50, 0, -40, 0, 30, 0, -1, 0], "XenoBloom"),
            (30, [-300, 0, -30, -16, 0, 0], [-280, 0, -150, 0, 0, -10, -5, 3], "ResoNex"),
            (50, [0, 20, 0, 30, 0, 0], [100, 200, 0, 0, 0, 6, 4, -4], "Fortivest"),
            (12, [-100, -8, 14, 8, 0, 0], [0, 0, -50, 0, -30, -3, 1, 0], "CogniFy"),
            (10, [-90, 4, -10, 0, 0, 0], [0, 0, -50, 0, 20, 2, -1, 0], "FortiGen"),
            (6, [-50, -2, 6, 0, 0, 0], [40, 40, -30, 6, 0, 0, -1, 0], "Abracadabra"),
            (6, [-60, 0, -5, 3, 0, 0], [-30, 50, -20, 12, 0, -2, 0, 0], "MegaBoost"),
            (48, [0, 20, 0, -20, 0, 0], [-300, 0, 200, 100, 50, -10, -6, 0], "NexuMax"),
            (20, [-100, -12, 0, -6, 0, 0], [200, -30, -5, 0, 0, -4, 3, 0], "SpicenRich"),
            (12, [90, -6, -10, -4, 0, 0], [100, 100, 0, -18, 0, 0, -2, 0], "EvolviFy"),
            (60, [0, 30, 60, 30, 0, 0], [0, 0, 0, 120, 100, 12, 8, -8], "NexroVest"),
            (30, [0, -10, -12, 2, 0, 0], [0, 0, 100, 60, -50, -9, -2, 0], "QuantumScribe"),
            (20, [-100, -5, 0, -6, 1, 0], [150, 120, 0, 0, 0, -4, -3, 0], "NeuroForge"),
            (40, [0, 18, -40, 0, -3, 0], [300, 0, 0, 90, -100, -10, 3, 0], "CyberPulse"),
            (40, [0, 20, 0, 0, 3, 0], [-200, -300, 180, -90, 0, -10, -4, 0], "PlasmaShift"),
            (20, [0, 10, -25, 0, -1, 0], [0, 150, -90, -40, 50, 0, -3, 0], "IlluGen"),
            (60, [0, -20, 0, -30, -4, 2], [500, 0, 0, 0, -120, -12, -8, 0], "Aespa"),
            (120, [900, 0, 0, 80, 0, 0], [1000, 600, 600, 0, 300, 30, 0, -20], "SuperNova"),
            (20, [-200, 9, 0, 0, 1, 0], [100, -180, 0, 0, 0, 0, -3, 0], "NeuroCharge"),
            (10, [-100, 0, 0, -5, 0, 0], [0, 100, 0, -20, -20, 0, 1, 0], "QuantumLeap"),
            (12, [-100, -6, 0, -6, 0, -1], [0, 100, 0, 30, 0, 3, 2, 0], "BioSynthesis"),
            (24, [0, -10, 20, 0, 0, -1], [0, 100, -100, 0, 0, 6, 0, 0], "PlasmaForge"),
            (80, [-500, 0, -50, -40, 0, -3], [0, 0, 0, 0, -150, -20, -8, 6], "NanoWeave"),
            (18, [-150, 10, -20, 0, 0, 1], [-160, 0, 80, 0, 0, 0, -3, 0], "EtherPulse"),
            (40, [30, -4, 0, 0, 0, -1], [10, 0, -10, -100, 80, 0, 3, 0], "StarLight"),
            (20, [0, 0, -3, 12, -1, 0], [0, 0, 0, -2, 0, -1, 0, 0], "NovaBurst"),
            (24, [0, 10, 0, 0, 0, -2], [-10, 0, 100, 50, 0, 0, -4, 0], "BioHarvest"),
            (20, [100, 0, 20, -10, -1, 1], [0, -100, 0, 0, -50, 0, -3, 0], "EtherForge"),
            (120, [-1000, 0, -150, 0, 0, -4], [0, 0, -400, -200, 0, -30, -14, 10], "TitanBloom"),
            (22, [-80, 6, 0, 0, -1, 0], [-200, 0, -90, 0, 50, 0, 0, 0], "QuantumFrost"),
            (28, [0, -10, 32, 0, 0, -1], [0, -200, 120, 0, -60, -8, 4, 0], "BioFusion"),
            (20, [0, 0, -24, 12, -2, 1], [-150, 200, -100, 0, 0, -5, 0, 0], "NexusField"),
            (30, [0, 8, 0, -16, 2, -1], [0, 0, 120, -70, 0, 0, 3, 0], "StarForge"),
            (20, [-100, 9, 20, 0, 0, -1], [0, 150, -90, 40, 0, 0, -3, 0], "PlasmaCharge"),
            (24, [100, -10, 0, 0, -2, 0], [-200, 0, 0, -50, 60, 4, 3, 0], "BioCast"),
            (26, [0, 12, -30, 12, -2, 1], [-200, 0, 0, 0, -60, 0, 0, 0], "EtherWeave"),
            (38, [-300, -24, 50, 0, 3, -1], [0, 0, -120, 0, 0, -12, 5, 0], "NovaFlux"),
            (44, [0, 0, 50, -30, -3, 2], [-400, 0, 120, 60, 0, 0, -8, 0], "QuantumCore"),
            (20, [0, -10, 20, 0, -2, 1], [0, 0, 0, -40, -40, 6, -3, 0], "BioSurge"),
            (20, [0, 0, -20, 12, -1, 1], [-160, 0, -80, 0, 0, -6, 3, 0], "EtherPulse"),
            (24, [-200, 15, 0, -10, 2, -1], [0, -200, 0, 50, 0, -6, 0, 0], "StarlightForge"),
            (120, [-1200, -80, -150, 0, -10, -5], [-1200, 0, 0, 0, 0, 0, -20, 12], "QuantumSurge")
        ],
    };
}

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }
    pub fn flush_settlement() -> Vec<u8> {
        SettleMentInfo::flush_settlement()
    }
}

pub fn get_modifier(index: u64) -> (usize, Modifier) {
    let (d, e, l, _) = CONFIG.modifiers[index as usize];
    (
        d,
        Modifier {
            entity: Attributes(e.to_vec()),
            local: Attributes(l.to_vec()),
            global: Attributes(vec![]),
        },
    )
}
