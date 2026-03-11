/**
 * Biological species prediction data ported from EDMC-BioScan
 * https://github.com/Silarn/EDMC-BioScan/tree/master/src/bio_scan/bio_data
 */
import type { SystemBody } from './types';
import { findRegion, regionName, systemInRegion } from './region_map';

export interface BioRuleset {
  atmosphere?: string[];
  body_type?: string[];
  min_gravity?: number;
  max_gravity?: number;
  min_temperature?: number;
  max_temperature?: number;
  min_pressure?: number;
  max_pressure?: number;
  volcanism?: 'None' | 'Any' | string[];
  star?: string | string[] | Array<string | string[] | [string, string]>;
  regions?: string[];
  region?: string[];
  guardian?: boolean;
  nebula?: string;
  tuber?: string[];
  atmosphere_component?: Record<string, number>;
  distance?: number;
  bodies?: string[];
  parent_star?: string[];
}

export interface BioSpecies {
  name: string;
  value: number;
  rulesets: BioRuleset[];
}

export interface BioMatch {
  name: string;
  value: number;
  uncertain: boolean;
}

// ---------------------------------------------------------------------------
// Complete species catalog
// ---------------------------------------------------------------------------

const SPECIES: BioSpecies[] = [
  // --- Aleoida ---
  {
    name: 'Aleoida Arcus', value: 7252500, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 175.0, max_temperature: 180.0,
      min_pressure: 0.0161, volcanism: 'None',
    }],
  },
  {
    name: 'Aleoida Coronamus', value: 6284600, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 180.0, max_temperature: 190.0,
      min_pressure: 0.025, volcanism: 'None',
    }],
  },
  {
    name: 'Aleoida Spica', value: 3385200, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 170.0, max_temperature: 177.0,
      max_pressure: 0.0135,
    }],
  },
  {
    name: 'Aleoida Laminiae', value: 3385200, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 165.0,
      max_pressure: 0.0135, regions: ['outer'],
    }],
  },
  {
    name: 'Aleoida Gravis', value: 12934900, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 190.0, max_temperature: 197.0,
      min_pressure: 0.054, volcanism: 'None',
    }],
  },

  // --- Anemone (all have region + star restrictions → uncertain) ---
  {
    name: 'Luteolum Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.044, max_gravity: 1.28, min_temperature: 200.0, max_temperature: 440.0,
      volcanism: ['metallic', 'silicate', 'rocky', 'water'],
      body_type: ['Rocky body'], star: ['B'], regions: ['anemone-a'],
    }],
  },
  {
    name: 'Croceum Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.047, max_gravity: 0.37, min_temperature: 200.0, max_temperature: 440.0,
      volcanism: ['silicate', 'rocky', 'metallic'],
      body_type: ['Rocky body'], star: ['B', 'A'], regions: ['anemone-a'],
    }],
  },
  {
    name: 'Puniceum Anemone', value: 1499900, rulesets: [
      {
        min_gravity: 0.17, max_gravity: 2.52, min_temperature: 65.0, max_temperature: 800.0,
        volcanism: 'None', body_type: ['Icy body', 'Rocky ice body'], star: ['O'], regions: ['anemone-a'],
      },
      {
        min_gravity: 0.17, max_gravity: 2.52, min_temperature: 65.0, max_temperature: 800.0,
        volcanism: ['carbon dioxide geysers'], body_type: ['Icy body', 'Rocky ice body'],
        star: ['O'], regions: ['anemone-a'],
      },
    ],
  },
  {
    name: 'Roseum Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.045, max_gravity: 0.37, min_temperature: 200.0, max_temperature: 440.0,
      volcanism: ['silicate', 'rocky', 'metallic'],
      body_type: ['Rocky body'], star: ['B'], regions: ['anemone-a'],
    }],
  },
  {
    name: 'Rubeum Bioluminescent Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.036, max_gravity: 4.61, min_temperature: 160.0, max_temperature: 1800.0,
      volcanism: 'Any', body_type: ['Metal rich body', 'High metal content body'],
      star: ['B', 'A', 'N'],
    }],
  },
  {
    name: 'Prasinum Bioluminescent Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.036, min_temperature: 110.0, max_temperature: 3050.0,
      body_type: ['Metal rich body', 'Rocky body', 'High metal content body'], star: ['O'],
    }],
  },
  {
    name: 'Roseum Bioluminescent Anemone', value: 1499900, rulesets: [{
      min_gravity: 0.036, max_gravity: 4.61, min_temperature: 400.0,
      volcanism: 'Any', body_type: ['Metal rich body', 'High metal content body'], star: ['B'],
    }],
  },
  {
    name: 'Blatteum Bioluminescent Anemone', value: 1499900, rulesets: [{
      min_temperature: 220.0, volcanism: 'Any',
      body_type: ['Metal rich body', 'High metal content body'],
      star: ['B'], regions: ['anemone-a'],
    }],
  },

  // --- Bacterium ---
  {
    name: 'Bacterium Aurasus', value: 1000000, rulesets: [{
      atmosphere: ['CarbonDioxide'],
      body_type: ['Rocky body', 'High metal content body', 'Rocky ice body'],
      min_gravity: 0.039, max_gravity: 0.608, min_temperature: 145.0, max_temperature: 400.0,
    }],
  },
  {
    name: 'Bacterium Nebulus', value: 5289900, rulesets: [
      {
        atmosphere: ['Helium'], body_type: ['Icy body'],
        min_gravity: 0.4, max_gravity: 0.55, min_temperature: 20.0, max_temperature: 21.0,
        min_pressure: 0.067,
      },
      {
        atmosphere: ['Helium'], body_type: ['Rocky ice body'],
        min_gravity: 0.4, max_gravity: 0.7, min_temperature: 20.0, max_temperature: 21.0,
        min_pressure: 0.067,
      },
    ],
  },
  {
    name: 'Bacterium Scopulum', value: 4934500, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.15, max_gravity: 0.26, min_temperature: 56, max_temperature: 150,
        volcanism: ['carbon dioxide', 'methane'],
      },
      {
        atmosphere: ['Helium'], body_type: ['Icy body'],
        min_gravity: 0.48, max_gravity: 0.51, min_temperature: 20, max_temperature: 21,
        min_pressure: 0.075, volcanism: ['methane'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.047, min_temperature: 84, max_temperature: 110,
        min_pressure: 0.03, volcanism: ['methane'],
      },
      {
        atmosphere: ['Neon'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.025, max_gravity: 0.61, min_temperature: 20, max_temperature: 65,
        max_pressure: 0.008, volcanism: ['carbon dioxide', 'methane'],
      },
      {
        atmosphere: ['NeonRich'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.025, max_gravity: 0.61, min_temperature: 20, max_temperature: 65,
        min_pressure: 0.005, volcanism: ['carbon dioxide', 'methane'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.2, max_gravity: 0.3, min_temperature: 60, max_temperature: 70,
        volcanism: ['carbon dioxide', 'methane'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.27, max_gravity: 0.40, min_temperature: 150, max_temperature: 220,
        min_pressure: 0.01, volcanism: ['carbon dioxide', 'methane'],
      },
    ],
  },
  {
    name: 'Bacterium Acies', value: 1000000, rulesets: [{
      atmosphere: ['Neon'], body_type: ['Icy body', 'Rocky ice body'],
      min_gravity: 0.255, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 61.0,
      max_pressure: 0.01,
    }],
  },
  {
    name: 'Bacterium Vesicula', value: 1000000, rulesets: [{
      atmosphere: ['Argon'],
      min_gravity: 0.027, max_gravity: 0.51, min_temperature: 50.0, max_temperature: 245.0,
    }],
  },
  {
    name: 'Bacterium Alcyoneum', value: 1658500, rulesets: [{
      atmosphere: ['Ammonia'],
      body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.376, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135,
    }],
  },
  {
    name: 'Bacterium Tela', value: 1949000, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Icy body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.045, max_gravity: 0.45, min_temperature: 50.0, volcanism: 'Any',
      },
      {
        atmosphere: ['ArgonRich'],
        min_gravity: 0.24, max_gravity: 0.45, min_temperature: 50.0, max_temperature: 150.0,
        max_pressure: 0.05, volcanism: 'Any',
      },
      {
        atmosphere: ['Ammonia'],
        min_gravity: 0.025, max_gravity: 0.23, min_temperature: 165.0, max_temperature: 177.0,
        min_pressure: 0.0025, max_pressure: 0.02, volcanism: 'Any',
      },
      {
        atmosphere: ['CarbonDioxide'],
        min_gravity: 0.45, max_gravity: 0.61, min_temperature: 300.0,
        min_pressure: 0.006, volcanism: 'None',
      },
      {
        atmosphere: ['CarbonDioxide', 'CarbonDioxideRich'],
        min_gravity: 0.025, max_gravity: 0.61, min_temperature: 167.0,
        min_pressure: 0.006, volcanism: 'Any',
      },
      {
        atmosphere: ['Helium'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 21.0,
        min_pressure: 0.067, volcanism: 'Any',
      },
      {
        atmosphere: ['Methane'], body_type: ['Icy body', 'Rocky body', 'High metal content body'],
        min_gravity: 0.026, max_gravity: 0.126, min_temperature: 80.0, max_temperature: 109.0,
        min_pressure: 0.012, volcanism: 'Any',
      },
      {
        atmosphere: ['Neon'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.27, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 95.0,
        max_pressure: 0.008, volcanism: 'Any',
      },
      {
        atmosphere: ['NeonRich'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.27, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 95.0,
        min_pressure: 0.003, volcanism: 'Any',
      },
      {
        atmosphere: ['Nitrogen'],
        min_gravity: 0.21, max_gravity: 0.35, min_temperature: 55.0, max_temperature: 80.0,
        volcanism: 'Any',
      },
      {
        atmosphere: ['Oxygen'],
        min_gravity: 0.23, max_gravity: 0.5, min_temperature: 150.0, max_temperature: 240.0,
        min_pressure: 0.01, volcanism: 'Any',
      },
      {
        atmosphere: ['SulphurDioxide'],
        min_gravity: 0.18, max_gravity: 0.61, min_temperature: 148.0, max_temperature: 550.0,
        volcanism: 'Any',
      },
      {
        atmosphere: ['SulphurDioxide'],
        min_gravity: 0.18, max_gravity: 0.61, min_temperature: 300.0, max_temperature: 550.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.5, max_gravity: 0.55, min_temperature: 500.0, max_temperature: 650.0,
        volcanism: 'Any',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.063, volcanism: 'None',
      },
      {
        atmosphere: ['WaterRich'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.315, max_gravity: 0.44, min_temperature: 190.0, max_temperature: 330.0,
        min_pressure: 0.01, volcanism: 'Any',
      },
    ],
  },
  {
    name: 'Bacterium Informem', value: 8418000, rulesets: [
      {
        atmosphere: ['Nitrogen'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.05, max_gravity: 0.6, min_temperature: 42.5, max_temperature: 151.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.17, max_gravity: 0.63, min_temperature: 50.0, max_temperature: 90.0,
      },
    ],
  },
  {
    name: 'Bacterium Volu', value: 7774700, rulesets: [{
      atmosphere: ['Oxygen'],
      min_gravity: 0.239, max_gravity: 0.61, min_temperature: 143.5, max_temperature: 246.0,
      min_pressure: 0.013,
    }],
  },
  {
    name: 'Bacterium Bullaris', value: 1152500, rulesets: [
      {
        atmosphere: ['Methane'],
        min_gravity: 0.0245, max_gravity: 0.35, min_temperature: 67.0, max_temperature: 109.0,
      },
      {
        atmosphere: ['MethaneRich'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.44, max_gravity: 0.6, min_temperature: 74.0, max_temperature: 141.0,
        min_pressure: 0.01, max_pressure: 0.05, volcanism: 'None',
      },
    ],
  },
  {
    name: 'Bacterium Omentum', value: 4638900, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Icy body'],
        min_gravity: 0.045, max_gravity: 0.45, min_temperature: 50.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['ArgonRich'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.45, min_temperature: 80.0, max_temperature: 90.0,
        min_pressure: 0.01, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Helium'], body_type: ['Icy body'],
        min_gravity: 0.4, max_gravity: 0.51, min_temperature: 20.0, max_temperature: 21.0,
        min_pressure: 0.065, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Icy body'],
        min_gravity: 0.0265, max_gravity: 0.0455, min_temperature: 84.0, max_temperature: 108.0,
        min_pressure: 0.035, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Neon'], body_type: ['Icy body'],
        min_gravity: 0.31, max_gravity: 0.6, min_temperature: 20.0, max_temperature: 61.0,
        max_pressure: 0.0065, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['NeonRich'], body_type: ['Icy body'],
        min_gravity: 0.27, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 93.0,
        min_pressure: 0.0027, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.2, max_gravity: 0.26, min_temperature: 60.0, max_temperature: 80.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['WaterRich'], body_type: ['Icy body'],
        min_gravity: 0.38, max_gravity: 0.45, min_temperature: 190.0, max_temperature: 330.0,
        min_pressure: 0.07, volcanism: ['nitrogen', 'ammonia'],
      },
    ],
  },
  {
    name: 'Bacterium Cerbrus', value: 1689800, rulesets: [
      {
        atmosphere: ['SulphurDioxide'],
        body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.042, max_gravity: 0.605, min_temperature: 132.0, max_temperature: 500.0,
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.064, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.064, volcanism: ['water'],
      },
      {
        atmosphere: ['WaterRich'], body_type: ['Rocky ice body'],
        min_gravity: 0.4, max_gravity: 0.5, min_temperature: 190.0, max_temperature: 330.0,
        volcanism: 'None',
      },
    ],
  },
  {
    name: 'Bacterium Verrata', value: 3897000, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'Rocky ice body', 'Icy body'],
        min_gravity: 0.03, max_gravity: 0.09, min_temperature: 160.0, max_temperature: 180.0,
        max_pressure: 0.0135, volcanism: ['water'],
      },
      {
        atmosphere: ['Argon'], body_type: ['Rocky ice body', 'Icy body'],
        min_gravity: 0.165, max_gravity: 0.33, min_temperature: 57.5, max_temperature: 145.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['ArgonRich'], body_type: ['Icy body'],
        min_gravity: 0.04, max_gravity: 0.08, min_temperature: 80.0, max_temperature: 90.0,
        max_pressure: 0.01, volcanism: ['water'],
      },
      {
        atmosphere: ['CarbonDioxide', 'CarbonDioxideRich'], body_type: ['Rocky ice body', 'Icy body'],
        min_gravity: 0.25, max_gravity: 0.32, min_temperature: 167.0, max_temperature: 240.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['Helium'], body_type: ['Icy body'],
        min_gravity: 0.49, max_gravity: 0.53, min_temperature: 20.0, max_temperature: 21.0,
        min_pressure: 0.065, volcanism: ['water'],
      },
      {
        atmosphere: ['Neon'], body_type: ['Rocky ice body', 'Icy body'],
        min_gravity: 0.29, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 51.0,
        max_pressure: 0.075, volcanism: ['water'],
      },
      {
        atmosphere: ['NeonRich'], body_type: ['Rocky ice body', 'Icy body'],
        min_gravity: 0.43, max_gravity: 0.61, min_temperature: 20.0, max_temperature: 65.0,
        min_pressure: 0.005, volcanism: ['water'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.205, max_gravity: 0.241, min_temperature: 60.0, max_temperature: 80.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Rocky ice body', 'Icy body'],
        min_gravity: 0.24, max_gravity: 0.35, min_temperature: 154.0, max_temperature: 220.0,
        min_pressure: 0.01, volcanism: ['water'],
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.054, volcanism: ['water'],
      },
    ],
  },

  // --- Brain Trees (all require guardian presence → uncertain) ---
  {
    name: 'Roseum Brain Tree', value: 1593700, rulesets: [{
      min_temperature: 200.0, max_temperature: 500.0, volcanism: 'Any',
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Gypseeum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 400.0,
      max_gravity: 0.42, volcanism: ['metallic', 'rocky', 'silicate', 'water'],
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Ostrinum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Metal rich body', 'Rocky body', 'High metal content body'],
      volcanism: ['metallic', 'rocky', 'silicate'],
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Viride Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Rocky ice body'], min_temperature: 100.0, max_temperature: 270.0,
      max_gravity: 0.4, volcanism: 'Any',
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Aureum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Metal rich body', 'High metal content body'],
      min_temperature: 300.0, max_temperature: 500.0, max_gravity: 2.9,
      volcanism: ['metallic', 'rocky', 'silicate'],
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Puniceum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Metal rich body', 'High metal content body'],
      volcanism: 'Any', guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Lindigoticum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Rocky body', 'High metal content body'],
      min_temperature: 300.0, max_temperature: 500.0, max_gravity: 2.7,
      volcanism: ['rocky', 'silicate', 'metallic'],
      guardian: true, region: ['brain-tree'],
    }],
  },
  {
    name: 'Lividum Brain Tree', value: 1593700, rulesets: [{
      body_type: ['Rocky body'], min_temperature: 300.0, max_temperature: 500.0,
      max_gravity: 0.5, volcanism: ['metallic', 'rocky', 'silicate', 'water'],
      guardian: true, region: ['brain-tree'],
    }],
  },

  // --- Cactoida ---
  {
    name: 'Cactoida Cortexum', value: 3667600, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 180.0, max_temperature: 197.0,
      min_pressure: 0.025, volcanism: 'None', regions: ['orion-cygnus'],
    }],
  },
  {
    name: 'Cactoida Lapis', value: 2483600, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['sagittarius-carina'],
    }],
  },
  {
    name: 'Cactoida Vermis', value: 16202800, rulesets: [
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.265, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 210.0,
        max_pressure: 0.005, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: ['water'],
      },
    ],
  },
  {
    name: 'Cactoida Pullulanta', value: 3667600, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 180.0, max_temperature: 197.0,
      min_pressure: 0.025, volcanism: 'None', regions: ['perseus'],
    }],
  },
  {
    name: 'Cactoida Peperatis', value: 2483600, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['scutum-centaurus'],
    }],
  },

  // --- Clypeus ---
  {
    name: 'Clypeus Lacrimam', value: 8418000, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 190.0,
        min_pressure: 0.054, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: ['water'],
      },
    ],
  },
  {
    name: 'Clypeus Margaritus', value: 11873200, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 190.0, max_temperature: 197.0,
        min_pressure: 0.054, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: 'None',
      },
    ],
  },
  {
    name: 'Clypeus Speculumi', value: 16202800, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 190.0, max_temperature: 197.0,
        min_pressure: 0.055, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, volcanism: ['water'],
      },
    ],
  },

  // --- Concha ---
  {
    name: 'Concha Renibus', value: 4572400, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.045, min_temperature: 176.0, max_temperature: 177.0,
        volcanism: ['silicate', 'metallic'],
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 180.0,
        min_pressure: 0.025, volcanism: 'None',
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.15, min_temperature: 78.0, max_temperature: 100.0,
        min_pressure: 0.01, volcanism: ['silicate', 'metallic'],
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.65, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.65, volcanism: ['water'],
      },
    ],
  },
  {
    name: 'Concha Aureolas', value: 7774700, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135,
    }],
  },
  {
    name: 'Concha Labiata', value: 2352400, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 150.0, max_temperature: 200.0,
      min_pressure: 0.002, volcanism: 'None',
    }],
  },
  {
    name: 'Concha Biconcavis', value: 16777215, rulesets: [{
      atmosphere: ['Nitrogen'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.053, max_gravity: 0.275, min_temperature: 42.0, max_temperature: 52.0,
      max_pressure: 0.0047, volcanism: 'None',
    }],
  },

  // --- Electricae (nebula required → uncertain) ---
  {
    name: 'Electricae Pluma', value: 6284600, rulesets: [
      {
        atmosphere: ['Argon', 'ArgonRich'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 150.0,
        parent_star: ['A', 'N', 'D', 'H'],
      },
      {
        atmosphere: ['Neon', 'NeonRich'], body_type: ['Icy body'],
        min_gravity: 0.26, max_gravity: 0.276, min_temperature: 20.0, max_temperature: 70.0,
        max_pressure: 0.005, parent_star: ['A', 'N', 'D', 'H'],
      },
    ],
  },
  {
    name: 'Electricae Radialem', value: 6284600, rulesets: [
      {
        atmosphere: ['Argon', 'ArgonRich'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 150.0,
        nebula: 'all',
      },
      {
        atmosphere: ['Neon', 'NeonRich'], body_type: ['Icy body'],
        min_gravity: 0.026, max_gravity: 0.276, min_temperature: 20.0, max_temperature: 70.0,
        max_pressure: 0.005, nebula: 'all',
      },
    ],
  },

  // --- Fonticulua ---
  {
    name: 'Fonticulua Segmentatus', value: 19010800, rulesets: [{
      atmosphere: ['Neon', 'NeonRich'], body_type: ['Icy body'],
      min_gravity: 0.25, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 75.0,
      max_pressure: 0.006, volcanism: 'None',
    }],
  },
  {
    name: 'Fonticulua Campestris', value: 1000000, rulesets: [{
      atmosphere: ['Argon'], body_type: ['Icy body', 'Rocky ice body'],
      min_gravity: 0.027, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 150.0,
    }],
  },
  {
    name: 'Fonticulua Upupam', value: 5727600, rulesets: [{
      atmosphere: ['ArgonRich'], body_type: ['Icy body', 'Rocky ice body'],
      min_gravity: 0.209, max_gravity: 0.276, min_temperature: 61.0, max_temperature: 125.0,
      min_pressure: 0.0175,
    }],
  },
  {
    name: 'Fonticulua Lapida', value: 3111000, rulesets: [{
      atmosphere: ['Nitrogen'], body_type: ['Icy body', 'Rocky ice body'],
      min_gravity: 0.19, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 81.0,
    }],
  },
  {
    name: 'Fonticulua Fluctus', value: 20000000, rulesets: [{
      atmosphere: ['Oxygen'], body_type: ['Icy body'],
      min_gravity: 0.235, max_gravity: 0.276, min_temperature: 143.0, max_temperature: 200.0,
      min_pressure: 0.012,
    }],
  },
  {
    name: 'Fonticulua Digitos', value: 1804100, rulesets: [{
      atmosphere: ['Methane'], body_type: ['Icy body', 'Rocky ice body'],
      min_gravity: 0.025, max_gravity: 0.07, min_temperature: 83.0, max_temperature: 109.0,
      min_pressure: 0.03,
    }],
  },

  // --- Frutexa ---
  {
    name: 'Frutexa Flabellum', value: 1808900, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['!scutum-centaurus'],
    }],
  },
  {
    name: 'Frutexa Acus', value: 7774700, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.237, min_temperature: 146.0, max_temperature: 197.0,
      min_pressure: 0.0029, volcanism: 'None', regions: ['orion-cygnus'],
    }],
  },
  {
    name: 'Frutexa Metallicum', value: 1632500, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 176.0,
        max_pressure: 0.01, volcanism: 'None',
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 146.0, max_temperature: 197.0,
        min_pressure: 0.002, volcanism: 'None',
      },
      {
        atmosphere: ['Methane'], body_type: ['High metal content body'],
        min_gravity: 0.05, max_gravity: 0.1, min_temperature: 100.0, max_temperature: 300.0,
      },
      {
        atmosphere: ['Water'], body_type: ['High metal content body'],
        min_gravity: 0.04, max_gravity: 0.07, max_temperature: 400.0,
        max_pressure: 0.07, volcanism: 'None',
      },
    ],
  },
  {
    name: 'Frutexa Flammasis', value: 10326000, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['scutum-centaurus'],
    }],
  },
  {
    name: 'Frutexa Fera', value: 1632500, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 146.0, max_temperature: 197.0,
      min_pressure: 0.003, volcanism: 'None', regions: ['outer'],
    }],
  },
  {
    name: 'Frutexa Sponsae', value: 5988000, rulesets: [
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.056, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.056, volcanism: ['water'],
      },
    ],
  },
  {
    name: 'Frutexa Collum', value: 1639800, rulesets: [
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 215.0,
        max_pressure: 0.004,
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.265, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 135.0,
        max_pressure: 0.004, volcanism: 'None',
      },
    ],
  },

  // --- Fumerola ---
  {
    name: 'Fumerola Carbosis', value: 6284600, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.168, max_gravity: 0.276, min_temperature: 57.0, max_temperature: 150.0,
        volcanism: ['carbon', 'methane'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.047, min_temperature: 84.0, max_temperature: 110.0,
        min_pressure: 0.03, volcanism: ['methane magma'],
      },
      {
        atmosphere: ['Neon'], body_type: ['Icy body'],
        min_gravity: 0.26, max_gravity: 0.276, min_temperature: 40.0, max_temperature: 60.0,
        volcanism: ['carbon', 'methane'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.2, max_gravity: 0.276, min_temperature: 57.0, max_temperature: 70.0,
        volcanism: ['carbon', 'methane'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.26, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 180.0,
        volcanism: ['carbon'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.185, max_gravity: 0.276, min_temperature: 149.0, max_temperature: 272.0,
        volcanism: ['carbon', 'methane'],
      },
      {
        atmosphere: ['Ammonia', 'ArgonRich', 'CarbonDioxideRich'], body_type: ['Icy body'],
        max_gravity: 0.276, volcanism: ['carbon'],
      },
    ],
  },
  {
    name: 'Fumerola Extremus', value: 16202800, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.09, min_temperature: 161.0, max_temperature: 177.0,
        max_pressure: 0.0135, volcanism: ['silicate', 'metallic', 'rocky'],
      },
      {
        atmosphere: ['Argon'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.07, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 121.0,
        volcanism: ['silicate', 'metallic', 'rocky'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.025, max_gravity: 0.127, min_temperature: 77.0, max_temperature: 109.0,
        min_pressure: 0.01, volcanism: ['silicate', 'metallic', 'rocky'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body', 'Rocky ice body'],
        min_gravity: 0.07, max_gravity: 0.276, min_temperature: 54.0, max_temperature: 210.0,
        volcanism: ['silicate', 'metallic', 'rocky'],
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.05, max_gravity: 0.276, min_temperature: 500.0,
        volcanism: ['silicate', 'metallic', 'rocky'],
      },
    ],
  },
  {
    name: 'Fumerola Nitris', value: 7500900, rulesets: [
      {
        atmosphere: ['Neon'], body_type: ['Icy body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 30.0, max_temperature: 129.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Argon', 'ArgonRich', 'NeonRich'], body_type: ['Icy body'],
        min_gravity: 0.044, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 141.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Icy body'],
        min_gravity: 0.025, max_gravity: 0.1, min_temperature: 83.0, max_temperature: 109.0,
        volcanism: ['nitrogen'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.21, max_gravity: 0.276, min_temperature: 60.0, max_temperature: 81.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        max_gravity: 0.276, min_temperature: 150.0, volcanism: ['nitrogen', 'ammonia'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Icy body'],
        min_gravity: 0.21, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 250.0,
        volcanism: ['nitrogen', 'ammonia'],
      },
    ],
  },
  {
    name: 'Fumerola Aquatis', value: 6284600, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Icy body', 'Rocky ice body', 'Rocky body'],
        min_gravity: 0.028, max_gravity: 0.276, min_temperature: 161.0, max_temperature: 177.0,
        min_pressure: 0.002, max_pressure: 0.02, volcanism: ['water'],
      },
      {
        atmosphere: ['Argon', 'ArgonRich'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.166, max_gravity: 0.276, min_temperature: 57.0, max_temperature: 150.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Icy body'],
        min_gravity: 0.25, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 180.0,
        min_pressure: 0.01, max_pressure: 0.03, volcanism: ['water'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 80.0, max_temperature: 100.0,
        min_pressure: 0.01, volcanism: ['water'],
      },
      {
        atmosphere: ['Neon'], body_type: ['Icy body'],
        min_gravity: 0.26, max_gravity: 0.276, min_temperature: 20.0, max_temperature: 60.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Icy body'],
        min_gravity: 0.195, max_gravity: 0.245, min_temperature: 56.0, max_temperature: 80.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.276, min_temperature: 153.0, max_temperature: 190.0,
        min_pressure: 0.01, volcanism: ['water'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Icy body', 'Rocky ice body', 'Rocky body'],
        min_gravity: 0.18, max_gravity: 0.276, min_temperature: 150.0, max_temperature: 270.0,
        volcanism: ['water'],
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.06, volcanism: ['water'],
      },
    ],
  },

  // --- Fungoida ---
  {
    name: 'Fungoida Setisis', value: 1670100, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
        max_pressure: 0.0135,
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky ice body'],
        min_gravity: 0.033, max_gravity: 0.276, min_temperature: 68.0, max_temperature: 109.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.033, max_gravity: 0.276, min_temperature: 67.0, max_temperature: 109.0,
      },
    ],
  },
  {
    name: 'Fungoida Stabitis', value: 2680300, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'Rocky ice body'],
        min_gravity: 0.04, max_gravity: 0.045, min_temperature: 172.0, max_temperature: 177.0,
        volcanism: ['silicate'], regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['Argon'], body_type: ['Rocky ice body'],
        min_gravity: 0.20, max_gravity: 0.23, min_temperature: 60.0, max_temperature: 90.0,
        volcanism: ['silicate', 'rocky'], regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['ArgonRich'], body_type: ['Icy body'],
        min_gravity: 0.3, max_gravity: 0.5, min_temperature: 60.0, max_temperature: 90.0,
        regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.0405, max_gravity: 0.27, min_temperature: 180.0,
        min_pressure: 0.025, volcanism: 'None', regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body'],
        min_gravity: 0.043, max_gravity: 0.126, min_temperature: 78.5, max_temperature: 109.0,
        min_pressure: 0.012, volcanism: ['major silicate'], regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.039, max_gravity: 0.064, volcanism: 'None', regions: ['orion-cygnus'],
      },
    ],
  },
  {
    name: 'Fungoida Bullarum', value: 3703200, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.058, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 129.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['Nitrogen'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.155, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 70.0,
        volcanism: 'None',
      },
    ],
  },
  {
    name: 'Fungoida Gelata', value: 3330300, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Rocky body', 'Rocky ice body'],
        min_gravity: 0.041, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 180.0,
        max_pressure: 0.0135, volcanism: ['major silicate'], regions: ['!orion-cygnus-core'],
      },
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body', 'Rocky ice body'],
        min_gravity: 0.042, max_gravity: 0.071, min_temperature: 160.0, max_temperature: 180.0,
        max_pressure: 0.0135, volcanism: ['major silicate'], regions: ['!orion-cygnus-core'],
      },
      {
        atmosphere: ['Ammonia'], body_type: ['High metal content body'],
        min_gravity: 0.042, max_gravity: 0.071, min_temperature: 160.0, max_temperature: 180.0,
        max_pressure: 0.0135, volcanism: ['major rocky'], regions: ['!orion-cygnus-core'],
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.041, max_gravity: 0.276, min_temperature: 180.0,
        min_pressure: 0.025, volcanism: 'None', regions: ['!orion-cygnus-core'],
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.044, max_gravity: 0.125, min_temperature: 80.0, max_temperature: 110.0,
        min_pressure: 0.01, volcanism: ['major silicate', 'major metallic'], regions: ['!orion-cygnus-core'],
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.039, max_gravity: 0.063, volcanism: 'None', regions: ['!orion-cygnus-core'],
      },
    ],
  },

  // --- Osseus ---
  {
    name: 'Osseus Fractus', value: 4027800, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 180.0,
      min_pressure: 0.025, volcanism: 'None', regions: ['!perseus'],
    }],
  },
  {
    name: 'Osseus Discus', value: 12934900, rulesets: [
      {
        atmosphere: ['Ammonia'],
        body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.088, min_temperature: 161.0, max_temperature: 177.0,
        max_pressure: 0.0135, volcanism: 'Any',
      },
      {
        atmosphere: ['Argon'], body_type: ['Rocky ice body'],
        min_gravity: 0.2, max_gravity: 0.276, min_temperature: 65.0, max_temperature: 120.0,
        volcanism: 'Any',
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.026, max_gravity: 0.276, min_temperature: 500.0, volcanism: 'Any',
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.127, min_temperature: 80.0, max_temperature: 110.0,
        min_pressure: 0.012, volcanism: 'Any',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.055,
      },
    ],
  },
  {
    name: 'Osseus Spiralis', value: 2404700, rulesets: [{
      atmosphere: ['Ammonia'],
      body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 160.0, max_temperature: 177.0,
      max_pressure: 0.0135,
    }],
  },
  {
    name: 'Osseus Pumice', value: 3156300, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.059, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 135.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['Argon'], body_type: ['Rocky ice body'],
        min_gravity: 0.059, max_gravity: 0.276, min_temperature: 50.0, max_temperature: 135.0,
        volcanism: ['water', 'geysers'],
      },
      {
        atmosphere: ['ArgonRich'], body_type: ['Rocky ice body'],
        min_gravity: 0.035, max_gravity: 0.276, min_temperature: 60.0, max_temperature: 80.5,
        min_pressure: 0.03, volcanism: 'None',
      },
      {
        atmosphere: ['Methane'],
        body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.033, max_gravity: 0.276, min_temperature: 67.0, max_temperature: 109.0,
      },
      {
        atmosphere: ['Nitrogen'],
        body_type: ['Rocky body', 'Rocky ice body', 'High metal content body'],
        min_gravity: 0.05, max_gravity: 0.276, min_temperature: 42.0, max_temperature: 70.1,
        volcanism: 'None',
      },
    ],
  },
  {
    name: 'Osseus Cornibus', value: 1483000, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.0405, max_gravity: 0.276, min_temperature: 180.0,
      min_pressure: 0.025, volcanism: 'None', regions: ['perseus'],
    }],
  },
  {
    name: 'Osseus Pellebantus', value: 9739000, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.0405, max_gravity: 0.276, min_temperature: 191.0,
      min_pressure: 0.057, volcanism: 'None', regions: ['!perseus'],
    }],
  },

  // --- Recepta (atmosphere_component SO2 check → uncertain) ---
  {
    name: 'Recepta Umbrux', value: 12934900, rulesets: [
      {
        atmosphere: ['CarbonDioxide'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 151.0, max_temperature: 200.0,
        atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.276, min_temperature: 154.0, max_temperature: 175.0,
        min_pressure: 0.01, volcanism: 'None', atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.276, min_temperature: 154.0, max_temperature: 175.0,
        min_pressure: 0.01, volcanism: ['water'], atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['SulphurDioxide'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 273.0,
        atmosphere_component: { SulphurDioxide: 1.05 },
      },
    ],
  },
  {
    name: 'Recepta Deltahedronix', value: 16202800, rulesets: [
      {
        atmosphere: ['CarbonDioxide'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 150.0, max_temperature: 195.0,
        volcanism: 'None', atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Icy body', 'Rocky ice body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 150.0, max_temperature: 195.0,
        volcanism: ['water'], atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['SulphurDioxide'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 272.0,
        atmosphere_component: { SulphurDioxide: 1.05 },
      },
    ],
  },
  {
    name: 'Recepta Conditivus', value: 14313700, rulesets: [
      {
        atmosphere: ['CarbonDioxide', 'CarbonDioxideRich'],
        body_type: ['Icy body', 'Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 150.0, max_temperature: 195.0,
        volcanism: 'None', atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.276, min_temperature: 154.0, max_temperature: 175.0,
        min_pressure: 0.01, volcanism: 'None', atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Icy body'],
        min_gravity: 0.23, max_gravity: 0.276, min_temperature: 154.0, max_temperature: 175.0,
        min_pressure: 0.01, volcanism: ['water'], atmosphere_component: { SulphurDioxide: 1.05 },
      },
      {
        atmosphere: ['SulphurDioxide'],
        min_gravity: 0.04, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 275.0,
        atmosphere_component: { SulphurDioxide: 1.05 },
      },
    ],
  },

  // --- Crystalline Shards ---
  {
    name: 'Crystalline Shards', value: 1628800, rulesets: [{
      atmosphere: ['None', 'Argon', 'ArgonRich', 'CarbonDioxide', 'CarbonDioxideRich',
        'Helium', 'Methane', 'Neon', 'NeonRich'],
      max_gravity: 2.0, max_temperature: 273.0,
      star: ['A', 'F', 'G', 'K', 'MS', 'S'],
      regions: ['exterior'],
    }],
  },

  // --- Stratum ---
  {
    name: 'Stratum Excutitus', value: 2448900, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.48, min_temperature: 165.0, max_temperature: 190.0,
        min_pressure: 0.0035, volcanism: 'None', regions: ['orion-cygnus'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.27, max_gravity: 0.4, min_temperature: 165.0, max_temperature: 190.0,
        regions: ['orion-cygnus'],
      },
    ],
  },
  {
    name: 'Stratum Paleas', value: 1362000, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.35, min_temperature: 165.0, max_temperature: 177.0,
        max_pressure: 0.0135,
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.585, min_temperature: 165.0, max_temperature: 395.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['CarbonDioxideRich'], body_type: ['Rocky body'],
        min_gravity: 0.43, max_gravity: 0.585, min_temperature: 185.0, max_temperature: 260.0,
        min_pressure: 0.015, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.056, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.056, min_pressure: 0.065, volcanism: ['water'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Rocky body'],
        min_gravity: 0.39, max_gravity: 0.59, min_temperature: 165.0, max_temperature: 250.0,
        min_pressure: 0.022,
      },
    ],
  },
  {
    name: 'Stratum Laminamus', value: 2788300, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.34, min_temperature: 165.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['orion-cygnus'],
    }],
  },
  {
    name: 'Stratum Araneamus', value: 2448900, rulesets: [{
      atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.26, max_gravity: 0.57, min_temperature: 165.0, max_temperature: 373.0,
    }],
  },
  {
    name: 'Stratum Limaxus', value: 1362000, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.03, max_gravity: 0.4, min_temperature: 165.0, max_temperature: 190.0,
        min_pressure: 0.05, volcanism: 'None', regions: ['scutum-centaurus-core'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.27, max_gravity: 0.4, min_temperature: 165.0, max_temperature: 190.0,
        regions: ['scutum-centaurus-core'],
      },
    ],
  },
  {
    name: 'Stratum Cucumisis', value: 16202800, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.04, max_gravity: 0.6, min_temperature: 191.0, max_temperature: 371.0,
        volcanism: 'None', regions: ['sagittarius-carina'],
      },
      {
        atmosphere: ['CarbonDioxideRich'], body_type: ['Rocky body'],
        min_gravity: 0.44, max_gravity: 0.56, min_temperature: 210.0, max_temperature: 246.0,
        min_pressure: 0.01, volcanism: 'None', regions: ['sagittarius-carina'],
      },
      {
        atmosphere: ['Oxygen'], body_type: ['Rocky body'],
        min_gravity: 0.4, max_gravity: 0.6, min_temperature: 200.0, max_temperature: 250.0,
        min_pressure: 0.01, regions: ['sagittarius-carina'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.26, max_gravity: 0.55, min_temperature: 191.0, max_temperature: 373.0,
        regions: ['sagittarius-carina'],
      },
    ],
  },
  {
    name: 'Stratum Tectonicas', value: 19010800, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['High metal content body'],
        min_gravity: 0.045, max_gravity: 0.38, min_temperature: 165.0, max_temperature: 177.0,
      },
      {
        atmosphere: ['Argon', 'ArgonRich'], body_type: ['High metal content body'],
        min_gravity: 0.485, max_gravity: 0.54, min_temperature: 167.0, max_temperature: 199.0,
        volcanism: 'None',
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.045, max_gravity: 0.61, min_temperature: 165.0, max_temperature: 430.0,
      },
      {
        atmosphere: ['CarbonDioxideRich'], body_type: ['High metal content body'],
        min_gravity: 0.035, max_gravity: 0.61, min_temperature: 165.0, max_temperature: 260.0,
      },
      {
        atmosphere: ['Oxygen'], body_type: ['High metal content body'],
        min_gravity: 0.4, max_gravity: 0.52, min_temperature: 165.0, max_temperature: 246.0,
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.29, max_gravity: 0.62, min_temperature: 165.0, max_temperature: 450.0,
      },
      {
        atmosphere: ['Water'], body_type: ['High metal content body'],
        min_gravity: 0.045, max_gravity: 0.063, volcanism: 'None',
      },
    ],
  },
  {
    name: 'Stratum Frigus', value: 2637500, rulesets: [
      {
        atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.043, max_gravity: 0.54, min_temperature: 191.0, max_temperature: 365.0,
        min_pressure: 0.001, volcanism: 'None', regions: ['perseus-core'],
      },
      {
        atmosphere: ['CarbonDioxideRich'], body_type: ['Rocky body'],
        min_gravity: 0.45, max_gravity: 0.56, min_temperature: 200.0, max_temperature: 250.0,
        min_pressure: 0.01, volcanism: 'None', regions: ['perseus-core'],
      },
      {
        atmosphere: ['SulphurDioxide'], body_type: ['Rocky body'],
        min_gravity: 0.29, max_gravity: 0.52, min_temperature: 191.0, max_temperature: 369.0,
        regions: ['perseus-core'],
      },
    ],
  },

  // --- Sinuous Tubers (all require tuber zones → uncertain) ---
  {
    name: 'Roseum Sinuous Tubers', value: 1514500, rulesets: [{
      body_type: ['High metal content body'], min_temperature: 200.0, max_temperature: 500.0,
      volcanism: ['rocky magma'], tuber: ['Galactic Center', 'Odin A', 'Ryker B'],
    }],
  },
  {
    name: 'Prasinum Sinuous Tubers', value: 1514500, rulesets: [
      {
        body_type: ['Metal rich body', 'High metal content body', 'Rocky body'],
        min_temperature: 200.0, max_temperature: 500.0, volcanism: 'Any',
        tuber: ['Inner S-C Arm B 1'],
      },
      {
        body_type: ['Metal rich body', 'High metal content body'],
        min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major rocky magma', 'major silicate vapour'],
        tuber: ['Inner S-C Arm D', 'Norma Expanse B', 'Odin B'],
      },
      {
        body_type: ['Metal rich body', 'High metal content body'],
        min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major rocky magma', 'major silicate vapour'],
        regions: ['empyrean-straits'],
      },
    ],
  },
  {
    name: 'Albidum Sinuous Tubers', value: 1514500, rulesets: [{
      body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 500.0,
      volcanism: ['major silicate vapour', 'major metallic magma'],
      tuber: ['Inner S-C Arm B 2', 'Inner S-C Arm D', 'Trojan Belt'],
    }],
  },
  {
    name: 'Caeruleum Sinuous Tubers', value: 1514500, rulesets: [
      {
        body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major silicate vapour'],
        tuber: ['Galactic Center', 'Inner S-C Arm D', 'Norma Arm A'],
      },
      {
        body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major silicate vapour'], regions: ['empyrean-straits'],
      },
    ],
  },
  {
    name: 'Lindigoticum Sinuous Tubers', value: 1514500, rulesets: [{
      body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 500.0,
      volcanism: ['major silicate vapour'],
      tuber: ['Inner S-C Arm A', 'Inner S-C Arm C', 'Hawking B', 'Norma Expanse A', 'Odin B'],
    }],
  },
  {
    name: 'Violaceum Sinuous Tubers', value: 1514500, rulesets: [{
      body_type: ['Metal rich body', 'High metal content body'],
      min_temperature: 200.0, max_temperature: 500.0,
      volcanism: ['major rocky magma', 'major silicate vapour'],
      tuber: ['Arcadian Stream', 'Empyrean Straits', 'Norma Arm B'],
    }],
  },
  {
    name: 'Viride Sinuous Tubers', value: 1514500, rulesets: [
      {
        body_type: ['High metal content body'], min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major rocky magma', 'major silicate vapour'],
        tuber: ['Inner O-P Conflux', 'Izanami', 'Ryker A'],
      },
      {
        body_type: ['Rocky body'], min_temperature: 200.0, max_temperature: 500.0,
        volcanism: ['major rocky magma', 'major silicate vapour'],
        tuber: ['Inner O-P Conflux', 'Izanami', 'Ryker A'],
      },
    ],
  },
  {
    name: 'Blatteum Sinuous Tubers', value: 1514500, rulesets: [{
      body_type: ['Metal rich body', 'High metal content body'],
      min_temperature: 200.0, max_temperature: 500.0,
      volcanism: ['metallic magma', 'rocky magma', 'major silicate vapour'],
      tuber: ['Arcadian Stream', 'Inner Orion Spur', 'Inner S-C Arm B 2', 'Hawking A'],
    }],
  },

  // --- Tubus ---
  {
    name: 'Tubus Conifer', value: 2415500, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.041, max_gravity: 0.153, min_temperature: 160.0, max_temperature: 197.0,
      min_pressure: 0.003, volcanism: 'None', regions: ['perseus'],
    }],
  },
  {
    name: 'Tubus Sororibus', value: 5727600, rulesets: [
      {
        atmosphere: ['Ammonia'], body_type: ['High metal content body'],
        min_gravity: 0.045, max_gravity: 0.152, min_temperature: 160.0, max_temperature: 177.0,
        max_pressure: 0.0135,
      },
      {
        atmosphere: ['CarbonDioxide'], body_type: ['High metal content body'],
        min_gravity: 0.045, max_gravity: 0.152, min_temperature: 160.0, max_temperature: 195.0,
        volcanism: 'None',
      },
    ],
  },
  {
    name: 'Tubus Cavas', value: 11873200, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.152, min_temperature: 160.0, max_temperature: 197.0,
      min_pressure: 0.003, volcanism: 'None', regions: ['scutum-centaurus'],
    }],
  },
  {
    name: 'Tubus Rosarium', value: 2637500, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.153, min_temperature: 160.0, max_temperature: 177.0,
      max_pressure: 0.0135,
    }],
  },
  {
    name: 'Tubus Compagibus', value: 7774700, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body'],
      min_gravity: 0.04, max_gravity: 0.153, min_temperature: 160.0, max_temperature: 197.0,
      min_pressure: 0.003, volcanism: 'None', regions: ['sagittarius-carina'],
    }],
  },

  // --- Tussock ---
  {
    name: 'Tussock Pennata', value: 5853800, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.09, min_temperature: 146.0, max_temperature: 154.0,
      min_pressure: 0.00289, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Ventusa', value: 3227700, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.13, min_temperature: 155.0, max_temperature: 160.0,
      min_pressure: 0.00289, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Ignis', value: 1849000, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.2, min_temperature: 161.0, max_temperature: 170.0,
      min_pressure: 0.00289, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Cultro', value: 1766600, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['orion-cygnus'],
    }],
  },
  {
    name: 'Tussock Catena', value: 1766600, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['scutum-centaurus-core'],
    }],
  },
  {
    name: 'Tussock Pennatis', value: 1000000, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 147.0, max_temperature: 197.0,
      min_pressure: 0.00289, volcanism: 'None', regions: ['outer'],
    }],
  },
  {
    name: 'Tussock Serrati', value: 4447100, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.042, max_gravity: 0.23, min_temperature: 171.0, max_temperature: 174.0,
      min_pressure: 0.01, max_pressure: 0.071, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Albata', value: 3252500, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.042, max_gravity: 0.276, min_temperature: 175.0, max_temperature: 180.0,
      min_pressure: 0.016, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Propagito', value: 1000000, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 145.0, max_temperature: 197.0,
      min_pressure: 0.00289, volcanism: 'None', regions: ['scutum-centaurus'],
    }],
  },
  {
    name: 'Tussock Divisa', value: 1766600, rulesets: [{
      atmosphere: ['Ammonia'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.042, max_gravity: 0.276, min_temperature: 152.0, max_temperature: 177.0,
      max_pressure: 0.0135, regions: ['perseus-core'],
    }],
  },
  {
    name: 'Tussock Caputus', value: 3472400, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.041, max_gravity: 0.27, min_temperature: 181.0, max_temperature: 190.0,
      min_pressure: 0.0275, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Triticum', value: 7774700, rulesets: [{
      atmosphere: ['CarbonDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 191.0, max_temperature: 197.0,
      min_pressure: 0.058, volcanism: 'None',
      regions: ['sagittarius-carina-core-9', 'perseus-core', 'orion-cygnus-core'],
    }],
  },
  {
    name: 'Tussock Stigmasis', value: 19010800, rulesets: [{
      atmosphere: ['SulphurDioxide'], body_type: ['Rocky body', 'High metal content body'],
      min_gravity: 0.04, max_gravity: 0.276, min_temperature: 132.0, max_temperature: 180.0,
      max_pressure: 0.01,
    }],
  },
  {
    name: 'Tussock Virgam', value: 14313700, rulesets: [
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.065, volcanism: 'None',
      },
      {
        atmosphere: ['Water'], body_type: ['Rocky body', 'High metal content body'],
        min_gravity: 0.04, max_gravity: 0.065, volcanism: ['water'],
      },
    ],
  },
  {
    name: 'Tussock Capillum', value: 7025800, rulesets: [
      {
        atmosphere: ['Argon'], body_type: ['Rocky ice body'],
        min_gravity: 0.22, max_gravity: 0.276, min_temperature: 80.0, max_temperature: 129.0,
      },
      {
        atmosphere: ['Methane'], body_type: ['Rocky body', 'Rocky ice body'],
        min_gravity: 0.033, max_gravity: 0.276, min_temperature: 80.0, max_temperature: 110.0,
      },
    ],
  },

  // --- Bark Mound (nebula required → uncertain) ---
  {
    name: 'Bark Mound', value: 1471900, rulesets: [{
      volcanism: 'Any', nebula: 'large', regions: ['!center'],
    }],
  },

  // --- Amphora Plant ---
  {
    name: 'Amphora Plant', value: 1628800, rulesets: [{
      body_type: ['Metal rich body'], atmosphere: ['None'],
      star: ['A'], min_temperature: 1000.0, max_temperature: 1750.0,
      volcanism: ['metallic', 'rocky', 'silicate'],
    }],
  },
];

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

/**
 * Match body volcanism against a ruleset volcanism requirement.
 * - undefined / 'Any': always passes
 * - 'None': body volcanism must be empty/null
 * - string[]: body volcanism must contain at least one of the substrings
 *   (items prefixed '=' are exact matches)
 */
function matchesVolcanism(
  bodyVolcanism: string | null | undefined,
  rule: BioRuleset['volcanism'],
): boolean {
  if (rule === undefined || rule === 'Any') return true;
  const vol = (bodyVolcanism ?? '').toLowerCase().trim();
  if (rule === 'None') return vol === '';
  // array of substrings
  return rule.some((term) => {
    if (term.startsWith('=')) {
      return vol === term.slice(1).toLowerCase();
    }
    return vol.includes(term.toLowerCase());
  });
}

/**
 * Extract the spectral-class prefix from a star class string.
 * e.g. "G2", "K5", "B1" → "G", "K", "B"; "MS" → "MS"; "DA" → "DA"
 */
function starPrefix(starClass: string): string {
  return starClass.replace(/[0-9]+.*$/, '');
}

/**
 * Match the system's star class against a ruleset's star requirement.
 * 'star' may be a string, array of strings, or array of tuples [class, luminosity].
 * We only match on spectral class (first element of tuple or full string).
 */
function matchesStar(
  bodyStarClass: string | null | undefined,
  rule: BioRuleset['star'] | BioRuleset['parent_star'],
): boolean {
  if (rule === undefined) return true;
  if (!bodyStarClass) return false;
  const prefix = starPrefix(bodyStarClass);
  const candidates = Array.isArray(rule) ? rule : [rule];
  for (const entry of candidates) {
    const cls = Array.isArray(entry) ? entry[0] : entry;
    if (prefix === cls || bodyStarClass.startsWith(cls)) return true;
  }
  return false;
}

/**
 * Determine whether a single ruleset matches the given body.
 * Returns: 'no' | 'yes' | 'uncertain'
 * - 'uncertain' means physical conditions are met but region/guardian/nebula/tuber
 *   data is unavailable so we cannot confirm
 */
function checkRuleset(
  ruleset: BioRuleset,
  species_name: string,
  body: SystemBody,
): 'no' | 'yes' | 'uncertain' {
  const atmoType = body.atmosphere_type ?? null;
  // Normalise: game may send '' for vacuum; treat as 'None'
  const atmoNorm = (atmoType === '' || atmoType === null) ? 'None' : atmoType;

  // Atmosphere
  if (ruleset.atmosphere !== undefined) {
    if (!ruleset.atmosphere.some(
      (a) => a.toLowerCase() === atmoNorm.toLowerCase()
    )) {
      console.log(`Atmosphere does not match ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Body type
  if (ruleset.body_type !== undefined && body.planet_class !== null && body.planet_class !== undefined) {
    if (!ruleset.body_type.some(
      (bt) => bt.toLowerCase() === body.planet_class!.toLowerCase()
    )) {
      console.log(`Body type does not match ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Gravity — journal SurfaceGravity is in m/s²; rulesets use G
  const EARTH_GRAVITY = 9.797759;
  const gravityG = (body.gravity !== null && body.gravity !== undefined)
    ? body.gravity / EARTH_GRAVITY
    : null;
  if (ruleset.min_gravity !== undefined && gravityG !== null) {
    if (gravityG < ruleset.min_gravity) { 
      console.log(`Gravity is lower than minimum gravity in ruleset for ${species_name}`); 
      return 'no'; 
    }
  }
  if (ruleset.max_gravity !== undefined && gravityG !== null) {
    if (gravityG >= ruleset.max_gravity) { 
      console.log(`Gravity is higher than maximum gravity in ruleset for ${species_name}`); 
      return 'no'; 
    }
  }

  // Temperature
  if (ruleset.min_temperature !== undefined && body.surface_temp !== null && body.surface_temp !== undefined) {
    if (body.surface_temp < ruleset.min_temperature) {
      console.log(`Temperature is lower than minimum temperature in ruleset for ${species_name}`); 
      return 'no';
    }
  }
  if (ruleset.max_temperature !== undefined && body.surface_temp !== null && body.surface_temp !== undefined) {
    if (body.surface_temp > ruleset.max_temperature) {
      console.log(`Temperature is higher than maximum temperature in ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Pressure — journal SurfacePressure is in Pa; rulesets use atm
  const ATM_PRESSURE = 101231.656250; // Pa — matches EDMC-BioScan's divisor
  const pressureAtm = (body.pressure !== null && body.pressure !== undefined)
    ? body.pressure / ATM_PRESSURE
    : null;
  if (ruleset.min_pressure !== undefined && pressureAtm !== null) {
    if (pressureAtm < ruleset.min_pressure) {
      console.log(`Pressure is lower than minimum pressure in ruleset for ${species_name}`);
      return 'no';
    }
  }
  if (ruleset.max_pressure !== undefined && pressureAtm !== null) {
    if (pressureAtm >= ruleset.max_pressure) {
      console.log(`Pressure is higher than maximum pressure in ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Atmosphere component
  if (ruleset.atmosphere_component !== undefined) {
    if (!body.atmosphere_composition) return 'no';
    for (const [name, minPercent] of Object.entries(ruleset.atmosphere_component)) {
      const entry = body.atmosphere_composition.find(
        (c) => c.Name.toLowerCase() === name.toLowerCase()
      );
      if (!entry || entry.Percent < minPercent) {
        console.log(`Atmosphere component ${name} does not meet requirement for ${species_name}`);
        return 'no';
      }
    }
  }

  // Volcanism
  if (!matchesVolcanism(body.volcanism, ruleset.volcanism)) {
    console.log(`Star class does not match ruleset for ${species_name}`); 
    return 'no'; 
  }

  // Star type (uses system primary star class as approximation)
  const starClass = body.star_class ?? null;
  if (ruleset.star !== undefined) {
    if (!matchesStar(starClass, ruleset.star)) {
      console.log(`Star class does not match ruleset for ${species_name}`);
      return 'no';
    }
  }
  if (ruleset.parent_star !== undefined) {
    if (!matchesStar(starClass, ruleset.parent_star)) {
      console.log(`Parent star class does not match ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Region check

  // get regions from ruleset
  const regionList = ruleset.regions ?? ruleset.region ?? [];
  
  if (regionList.length > 0) {
    
    // if any of the star_systems coordinates are unavailable, we can't determine the region
    if (body.x == null || body.y == null || body.z == null) return 'uncertain';
    
    // get the region based on the star's coordinates
    const regionId = findRegion(body.x, body.y, body.z);
    console.log(`System is in region ${regionName(regionId)}`)

    // if region couldn't be found we still know nothing
    if (regionId === null) return 'uncertain';
    
    const isInRegion = (r: string) => systemInRegion(regionId, r);
    if (!regionList.some(isInRegion)) {
      console.log(`Region does not match ruleset for ${species_name}`);
      return 'no';
    }
  }

  // Physical conditions and region passed — check remaining uncertainty flags
  const isUncertain = (
    ruleset.guardian === true ||
    ruleset.nebula !== undefined ||
    ruleset.tuber !== undefined
  );

  return isUncertain ? 'uncertain' : 'yes';
}

/**
 * Return all species that could potentially be on the given body.
 * For each species: at least one ruleset must not return 'no'.
 * The result is marked uncertain if the best match across rulesets is 'uncertain'.
 */
export function getPossibleSpecies(body: SystemBody): BioMatch[] {
  // Only landable planets can have biologicals
  if (body.body_type !== 'Planet' && !body.landable) return [];

  const results: BioMatch[] = [];

  for (const species of SPECIES) {
    let bestResult: 'no' | 'uncertain' | 'yes' = 'no';
    for (const ruleset of species.rulesets) {
      const r = checkRuleset(ruleset, species.name, body);
      if (r === 'yes') { bestResult = 'yes'; break; }
      if (r === 'uncertain') bestResult = 'uncertain';
    }
    if (bestResult !== 'no') {
      results.push({ name: species.name, value: species.value, uncertain: bestResult === 'uncertain' });
    }
  }

  // Sort: certain matches first, then by value descending
  return results.sort((a, b) => {
    if (a.uncertain !== b.uncertain) return a.uncertain ? 1 : -1;
    return b.value - a.value;
  });
}
