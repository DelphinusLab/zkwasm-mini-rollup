use crate::settlement::SettleMentInfo;
use crate::state::Modifier;
use crate::state::Attributes;
use serde::Serialize;
const ENTITY_ATTRIBUTES_SIZE:usize = 6;
const LOCAL_ATTRIBUTES_SIZE:usize = 8;

#[derive (Serialize, Clone)]
pub struct Config {
    entity_attributes: [&'static str; ENTITY_ATTRIBUTES_SIZE],
    local_attributes: [&'static str; LOCAL_ATTRIBUTES_SIZE],
    modifiers: Vec<(usize, [i64; ENTITY_ATTRIBUTES_SIZE], [i64; LOCAL_ATTRIBUTES_SIZE], &'static str)>
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
            (2,[-1,0,0,0,0,0],[-1,-1,2,0,0,0,0,0],"Biogen"),
            (4,[1,0,0,0,0,0],[3,0,-1,0,0,0,0,0],"CrysTara"),
            (4,[1,0,0,0,0,0],[0,3,-1,0,0,0,0,0],"AstroMine"),
            (2,[-1,0,0,0,0,0],[-1,0,2,0,-1,0,0,0],"EnerGex"),
            (4,[1,0,0,0,0,0],[3,0,-1,0,0,0,0,0],"CrystaBloom"),
            (4,[1,0,0,0,0,0],[0,0,-1,0,3,0,0,0],"StellarBharge"),
            (4,[3,0,0,0,0,0],[0,-1,-4,0,5,0,0,0],"FoamBap"),
            (4,[2,0,0,0,0,0],[-2,0,-6,0,8,0,0,0],"EnerFusion"),
            (4,[6,0,0,0,0,0],[-1,-1,-3,0,1,0,0,0],"EnerPlex"),
            (48,[-10,0,0,0,0,0],[-6,-2,-6,0,-16,0,0,1],"TTgenesis"),
            (24,[-2,0,0,0,0,0],[-5,-1,-4,4,-2,0,0,0],"QuantaForge"),
            (36,[-1,2,0,0,0,0],[-5,-2,-8,-1,0,0,0,0],"FortifyX"),
            (44,[6,-4,0,0,0,0],[-2,0,-8,-3,0,0,0,3],"SynTitan"),
            (20,[-2,0,8,0,0,0],[-2,-2,-2,0,-2,0,0,0],"SwiftForge"),
            (30,[0,-1,0,0,0,0],[0,0,0,-2,0,6,0,0],"XenoFloral"),
            (118,[-5,0,-3,0,0,0],[0,0,0,-1,-40,-4,0,11],"TitaniumBoost"),
            (30,[-10,-6,-3,9,0,0],[-5,0,-2,-2,-12,0,0,0],"CerebraSpark"),
            (30,[-1,0,0,-2,0,0],[-2,-2,-1,-8,-10,2,0,0],"Quifoam"),
            (12,[-8,0,6,-4,0,0],[0,16,0,-1,0,-1,0,0],"AstroCharge"),
            (12,[16,0,0,-1,0,0],[-6,1,-10,-1,20,0,0,0], "EnerGate"),
            (24,[-3,0,0,3,0,0],[-8,4,-10,-6,3,5,0,0],"CogniMelt"),
            (60,[2,3,0,-4,0,0],[-4,-6,-3,0,2,-2,0,5],"TitanMine"),
            (12,[-1,-2,0,1,0,0],[-5,0,-3,0,6,2,0,0],"XenoBloom"),
            (12,[1,-2,0,0,0,0],[2,4,2,6,-1,-3,0,2],"Resonex"),
            (30,[-2,3,0,-10,0,0],[0,20,0,2,0,8,0,-1],"FortiVest"),
            (6,[-1,-2,3,3,0,0],[0,0,-2,0,-4,-1,0,0],"Cognify"),
            (6,[-3,4,-2,0,0,0],[0,-2,0,0,-3,0,0,0],"FortiGen"),
            (12,[-1,0,0,0,0,0],[-2,-2,-3,6,6,0,0,0],"Abracadabra"),
            (6,[-1,0,-2,-1,0,0],[-10,10,6,2,5,-1,0,0],"MegaBoost"),
            (240,[0,-5,-2,-6,0,0],[-3,-9,0,-3,-5,-2,0,32],"NexuMax"),
            (24,[-1,-2,0,-3,0,0],[-10,-3,-5,0,0,-4,3,0],"SpicenRich"),
            (12,[3,-6,-10,3,0,0],[0,20,0,6,4,3,-2,0],"Evolvify"),
            (60,[60,-40,20,9,0,0],[0,0,0,0,5,5,0,-3],"NexroVest"),
            (90,[60,-4,-5,0,0,0],[0,0,9,5,-3,-2,-4,10],"QuantumScribe"),
            (60,[0,-5,0,-3,2,0],[-3,-3,-2,-1,-3,0,-1,0],"NeuroForge"),
            (30,[0,5,0,0,-5,0],[10,10,-8,1,-3,-2, 4, 0],"CyberPulse"),
            (60,[3,0,0,0,6,0],[-4,-4,-3,-2,-1,0,-2,0],"PlasmaShift"),
            (60,[-20,40,-10,0,-8,0],[0,20,0,15,20,4,-10,0],"IlluGen"),
            (180,[0,-20,-8,-6,-10,0],[0,0,-10,0,-10,-4,-5,36],"Aespa"),
            (120,[10,5,6,3,0,0],[20,10,5,0,10,0,0,-5],"SuperNova"),
            (20,[-2,3,0,0,1,0],[-1,2,-2,0,0,0,0,2],"NeuroCharge"),
            (30,[-3,0,2,-1,0,0],[0,3,0,-1,-2,0,1,0],"QuantumLeap"),
            (12,[2,-1,0,-2,0,0],[3,-1,1,0,0,1,-1,0],"BioSynthesis"),
            (24,[0,-3,2,0,-1,2],[0,1,-1,0,2,-3,0,0],"PlasmaForge"),
            (36,[1,0,-2,3,0,-2],[2,0,0,0,-12,-2,1,4],"NanoWeave"),
            (18,[-1,2,-3,1,0,0],[-2,0,3,0,0,1,-1,0],"EtherPulse"),
            (40,[3,-2,0,0,1,-1],[1,0,-1,0,2,0,1,0],"Starlight"),
            (50,[2,0,-3,2,-1,0],[0,3,0,-2,1,-1,0,0],"NovaBurst"),
            (14,[-1,1,0,0,0,-2],[3,-1,2,1,0,0,0,1],"BioHarvest"),
            (32,[1,0,2,-3,0,1],[0,2,0,1,-1,1,0,2],"EtherForge"),
            (25,[0,-1,0,0,0,2],[3,0,1,-1,0,2,-1,3],"TitanBloom"),
            (22,[-2,3,1,0,-1,0],[-2,0,2,0,1,0,0,0],"QuantumFrost"),
            (28,[2,-1,0,1,0,-2],[0,1,2,0,-1,0,1,4],"BioFusion"),
            (20,[1,0,-2,3,0,0],[-1,3,0,-1,2,-2,0,5],"NexusField"),
            (30,[0,2,0,-1,3,-2],[0,1,2,-2,0,1,1,0],"StarForge"),
            (35,[-2,3,1,0,0,-1],[0,2,-1,1,0,0,1,0],"PlasmaCharge"),
            (24,[3,-2,0,1,-1,0],[1,2,0,-1,2,0,1,0],"BioCast"),
            (26,[1,0,-1,2,0,1],[-2,0,3,0,1,-1,0,0],"EtherWeave"),
            (38,[2,-1,3,0,1,-2],[0,3,-1,0,1,0,1,0],"NovaFlux"),
            (44,[0,2,-1,0,3,1],[-3,0,2,-1,0,1,1,0],"QuantumCore"),
            (50,[2,-3,1,0,0,1],[0,1,3,0,-1,2,-1,0],"BioSurge"),
            (42,[1,0,-2,3,0,1],[2,-2,0,1,0,2,-1,0],"EtherPulse"),
            (48,[-1,2,0,0,3,-1],[0,3,-2,1,0,1,0,0],"StarlightForge"),
            (240,[30,-20,-2,0,0,12],[0,2,-100,0,10,0,10,45],"QuantumSurge")
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
    (d, Modifier {
        entity: Attributes (e.to_vec()),
        local: Attributes (l.to_vec()),
        global: Attributes (vec![])
    })
}
