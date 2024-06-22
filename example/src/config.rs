use crate::settlement::SettleMentInfo;
use crate::state::Attributes;
use crate::state::Modifier;
use serde::Serialize;
const ENTITY_ATTRIBUTES_SIZE: usize = 6;
const LOCAL_ATTRIBUTES_SIZE: usize = 8;

#[derive(Serialize, Clone)]
pub struct Config {
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
    [2, 0, 0, 0, 0, 0]
}

pub fn default_local() -> [i64; LOCAL_ATTRIBUTES_SIZE] {
    [10, 10, 0, 0, 2, 0, 0, 0]
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        entity_attributes: ["Enercore", "Nexium", "Swifex", "Cognisurge", "Vitalshield", "Flexonix"],
        local_attributes: ["Engery Crystal", "Instellar Mineral", "Biomass", "Quantum Foam", "Necrodermis", "Alien Floral", "Spice Melange", "Treasure"],
        modifiers: vec![
            (2, [-1, 0, 0, 0, 0, 0], [-1, -1, 2, 0, 0, 0, 0, 0], "BioGen"),
            (4, [1, 0, 0, 0, 0, 0], [3, 0, -1, 0, 0, 0, 0, 0], "Crystara"),
            (4, [1, 0, 0, 0, 0, 0], [0, 3, -1, 0, 0, 0, 0, 0], "AstroMine"),
            (4, [1, 0, 0, 0, 0, 0], [1, 0, -3, 0, 2, 0, 0, 0], "CrystaBloom"),
            (4, [-1, 0, 1, 0, 0, 0], [-3, 0, 2, 0, -2, 0, 0, 0], "EnerGex"),
            (4, [-1, 0, 0, 0, 0, 0], [0, 0, -1, 1, 0, 0, 0, 0], "StellarCharge"),
            (4, [0, 0, 1, 0, 0, 0], [1, -1, 4, 0, -4, 0, 0, 0], "FoamTap"),
            (4, [2, 0, -1, 0, 0, 0], [-2, 0, -6, 2, 3, 0, 0, 0], "EnerFusion"),
            (4, [0, 0, 2, 0, 0, 0], [-4, 6, 3, -3, -3, 0, 0, 0], "EnerPlex"),
            (18, [-6, 0, -20, 0, 0, 0], [-50, -40, -12, -28, -30, 0, 0, 1], "TTgenesis"),
            (6, [-2, 3, -5, 0, 0, 0], [-5, -2, -4, 4, -2, 0, 0, 0], "QuantaForge"),
            (10, [-1, -1, 0, 0, 0, 0], [5, -4, -8, -2, 10, 0, 0, 0], "FortifyX"),
            (18, [0, -10, -20, 0, 0, 0], [-20, -24, -10, -12, -20, 0, 0, 1], "Syntitan"),
            (20, [-2, 2, -2, 1, 0, 0], [-2, -4, 0, -3, -4, 0, 0, 0], "SwiftForge"),
            (4, [10, -1, 3, -1, 0, 0], [0, 2, 6, -3, -10, 1, 0, 0], "XenoFloral"),
            (30, [-100, -10, -12, -10, 0, 0], [0, 0, 6, -24, -30, -10, 0, 2], "TitaniumBoost"),
            (30, [-10, -6, 1, 9, 0, 0], [-10, -5, -2, -2, 10, -2, 0, 0], "CerebraSpark"),
            (10, [-30, 2, 2, -2, 0, 0], [-20, -10, 12, -6, -6, 2, 0, 0], "QuiFoam"),
            (12, [-20, 0, 2, -2, 0, 0], [0, 20, 14, 5, 0, -1, 0, 0], "AstroCharge"),
            (12, [16, -1, -1, -3, 0, 0], [-10, 10, -10, 0, 10, 1, 0, 0], "EnerGate"),
            (12, [-20, 0, 4, 3, 0, 0], [-8, 4, -10, -8, 3, -1, 0, 0], "CogniMelt"),
            (12, [20, 2, -2, -2, 0, 0], [-8, -6, -3, 2, 2, -2, 1, 0], "NexiMine"),
            (12, [-10, -2, -6, 8, 0, 0], [-4, 0, -1, 0, 8, 0, -1, 0], "XenoBloom"),
            (60, [1, -50, -30, -20, 0, 0], [-10, -7, 20, 18, -20, -10, -6, 4], "Resonex"),
            (50, [100, 0, 0, 30, 0, 0], [0, 20, 0, 20, 0, 6, 1, -2], "Fortivest"),
            (12, [-10, -8, 8, 8, 0, 0], [0, 0, -3, 0, -4, -3, 1, 0], "Cognify"),
            (10, [-3, 4, -2, 0, 0, 0], [0, -1, 0, 0, -3, -1, 0, 0], "FortiGen"),
            (6, [-10, -2, 0, 0, 0, 0], [-2, -2, -4, 6, 6, 0, 0, 0], "Abracadabra"),
            (6, [-1, 0, -2, -1, 0, 0], [-10, 10, 6, 2, 5, -1, 0, 0], "MegaBoost"),
            (48, [200, 0, 10, -10, 0, 0], [-200, 0, 0, 10, 50, -1, -2, 0], "Nexumax"),
            (20, [-1, -2, 0, -3, 0, 0], [-10, -3, -5, 0, 10, -4, 3, 0], "SpicenRich"),
            (12, [30, -6, -10, -4, 0, 0], [0, 100, 0, 18, 0, 3, -1, 0], "Evolvify"),
            (120, [120, -2, 20, 30, 0, 0], [0, 0, 0, 0, 100, 8, 0, -3], "NexroVest"),
            (30, [0, -10, -5, 1, 0, 0], [0, 9, 50, -3, -1, -1, 0, 0], "QuantumScribe"),
            (20, [-100, -5, 0, -3, 2, 0], [60, 40, 0, 0, 0, -2, -1, 0], "NeuroForge"),
            (40, [0, 5, -5, 0, -4, 0], [40, 50, 40, 30, -3, -2, 4, 0], "CyberPulse"),
            (40, [0, 4, 0, 0, 6, 0], [-40, -40, -30, -30, -40, -5, -4, 0], "PlasmaShift"),
            (20, [0, 40, -10, 0, -8, 0], [0, 200, 0, 0, 200, 3, -10, 0], "Illugen"),
            (60, [0, -20, -8, -6, -2, 3], [200, 0, 120, 0, -10, -4, -5, 0], "Aespa"),
            (200, [10, 0, 0, 20, 0, 0], [20, 20, 20, 0, 30, 12, 0, -2],"SuperNova"),
            (20, [-2, 3, 0, 0, 1, 0], [10, 2, 0, 0, 0, 0, -3, 0], "NeuroCharge"),
            (10, [-3, 0, 0, -3, 0, 0], [0, 3, 0, -5, -2, 0, 1, 0], "QuantumLeap"),
            (12, [-20, -1, 0, -2, 0, 0], [0, -30, 0, 0, 0, 1, 1, 0], "BioSynthesis"),
            (24, [0, -3, -2, 0, 0, -2], [0, 100, 200, 0, 0, 2, 0, 0], "PlasmaForge"),
            (80, [-100, 0, -20, -40, 0, -6], [20, 0, 0, 0, -12, -2, -2, 5], "NanoWeave"),
            (18, [-10, 20, -30, 10, 0, 0], [-2, 0, 30, 0, 0, 10, -10, 0], "EtherPulse"),
            (40, [30, -4, 0, 0, 0, -1], [10, 0, -10, 0, 20, 0, 3, 0], "StarLight"),
            (20, [0, 0, -3, 12, -1, 0], [0, 0, 0, -2, 0, -1, 0, 0], "NovaBurst"),
            (24, [0, 10, 0, 0, 0, -2], [-10, 0, 2, 10, 0, 1, 4, 0], "BioHarvest"),
            (12, [1, 0, 2, -3, -2, 1], [0, 0, 0, -1, 1, 0, 0, 0], "EtherForge"),
            (120, [0, -10, -10, 0, -10, -6], [-100, 0, 20, -160, 0, -60, -40, 8], "TitanBloom"),
            (22, [-2, 3, 1, 0, -1, 0], [-2, 0, 2, 0, 1, 0, 0, 0], "QuantumFrost"),
            (28, [2, -1, 0, 1, 0, -2], [0, 100, 0, -8, 0, 5, 0, 0], "BioFusion"),
            (20, [10, 0, -2, 3, -2, 1], [0, 0, 0, 0, 2, -2, 0, 0], "NexusField"),
            (30, [0, 4, 0, -1, 3, -2], [0, 0, 12, -2, 0, 0, 1, 0], "StarForge"),
            (20, [-2, 3, 1, 0, 0, -1], [0, 2, -1, 1, 0, 0, 1, 0], "PlasmaCharge"),
            (24, [3, -2, 0, 1, -1, 0], [1, 2, 0, -1, 2, 0, 2, 0], "BioCast"),
            (26, [1, 0, -1, 2, -4, 2], [-2, 0, 0, 0, 0, -1, 0, 0], "EtherWeave"),
            (38, [2, -1, 3, 0, 2, -2], [0, 3, -1, 0, 1, 0, 3, 0], "NovaFlux"),
            (44, [0, 2, -1, -10, -12, 5], [-3, 0, 20, 50, 0, 5, -1, 0], "QuantumCore"),
            (20, [0, -3, 10, 0, -2, 1], [0, 0, 3, 0, -1, 2, -2, 0], "BioSurge"),
            (20, [0, 0, -2, 3, -1, 1], [0, 0, 0, 1, 0, -8, 1, 0], "EtherPulse"),
            (24, [-100, 2, 0, -2, 3, -1], [0, -20, -30, 10, 0, -4, 2, 0], "StarlightForge"),
            (120, [-300, -20, -20, -50, -12, -10], [-160, -160, -120, -120, -100, -20, -40, 10], "QuantumSurge")
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
