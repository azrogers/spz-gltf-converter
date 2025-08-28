import yargs from "yargs";
import fs from "fs";
import { loadPly, serializeSpz } from "spz-js";
import { Readable } from "stream";
import gltfToGlb from "gltf-pipeline/lib/gltfToGlb.js";
import { file } from "tmp-promise";
import getJsonBufferPadded from "gltf-pipeline/lib/getJsonBufferPadded.js";

function getGlb(gltf, binaryBuffer) {
  const jsonBuffer = getJsonBufferPadded(gltf, 20);

  // Compute glb length: (Global header) + (JSON chunk header) + (JSON chunk) + [(Binary chunk header) + (Binary chunk)]
  let glbLength = 12 + 8 + jsonBuffer.length;

  if (binaryBuffer) {
    glbLength += 8 + binaryBuffer.length;
  }

  const glb = Buffer.alloc(glbLength);

  // Write binary glTF header (magic, version, length)
  let byteOffset = 0;
  glb.writeUInt32LE(0x46546c67, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(2, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(glbLength, byteOffset);
  byteOffset += 4;

  // Write JSON Chunk header (length, type)
  glb.writeUInt32LE(jsonBuffer.length, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(0x4e4f534a, byteOffset); // JSON
  byteOffset += 4;

  // Write JSON Chunk
  jsonBuffer.copy(glb, byteOffset);
  byteOffset += jsonBuffer.length;

  if (binaryBuffer) {
    // Write Binary Chunk header (length, type)
    glb.writeUInt32LE(binaryBuffer.length, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(0x004e4942, byteOffset); // BIN
    byteOffset += 4;

    // Write Binary Chunk
    binaryBuffer.copy(glb, byteOffset);
  }

  return glb;
}


async function writeSpzGltf(cloud, output) {
  const spzBytes = await serializeSpz(cloud);
  const gltf = {
    "extensionsUsed": [
      "KHR_materials_unlit",
      "KHR_gaussian_splatting",
      "KHR_gaussian_splatting_compression_spz_2"
    ],
    "extensionsRequired": [
      "KHR_materials_unlit",
      "KHR_gaussian_splatting",
      "KHR_gaussian_splatting_compression_spz_2"
    ],
    "asset": {
      "version": "2.0"
    },
    "accessors": [],
    "buffers": [
      {
        "byteLength": spzBytes.length
      }
    ],
    "bufferViews": [
      {
        "buffer": 0,
        "byteLength": spzBytes.length,
        "byteOffset": 0
      }
    ],
    "materials": [
      {
        "extensions": {
          "KHR_materials_unlit": {}
        }
      }
    ],
    "meshes": [
      {
        "primitives": [
          {
            "attributes": {},
            "extensions": {
              "KHR_gaussian_splatting": {
                "extensions": {
                  "KHR_gaussian_splatting_compression_spz": {
                    "bufferView": 0
                  }
                }
              }
            },
            "material": 0,
            "mode": 0
          }
        ],
        
      }
    ],
    "nodes": [
      {
        "matrix": [
          1,
          0,
          0,
          0,
          0,
          0,
          -1,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          0,
          1
        ],
        "mesh": 0
      }
    ],
    "scene": 0,
    "scenes": [
      {
        "nodes": [
          0
        ]
      }
    ]
  };

  const mins = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
  const maxs = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];
  for(let i = 0; i < cloud.numPoints; i++) {
    mins[0] = Math.min(mins[0], cloud.positions[i * 3 + 0]);
    mins[1] = Math.min(mins[1], cloud.positions[i * 3 + 1]);
    mins[2] = Math.min(mins[2], cloud.positions[i * 3 + 2]);
    maxs[0] = Math.max(maxs[0], cloud.positions[i * 3 + 0]);
    maxs[1] = Math.max(maxs[1], cloud.positions[i * 3 + 1]);
    maxs[2] = Math.max(maxs[2], cloud.positions[i * 3 + 2]);
  }

  gltf.meshes[0].primitives[0].attributes["POSITION"] = gltf.accessors.length;
  gltf.accessors.push({
    "componentType": 5126,
    "count": cloud.numPoints,
    "max": maxs,
    "min": mins,
    "type": "VEC3"
  });

  gltf.meshes[0].primitives[0].attributes["COLOR_0"] = gltf.accessors.length;
  gltf.accessors.push({
    "componentType": 5121,
    "count": cloud.numPoints,
    "type": "VEC4"
  });

  gltf.meshes[0].primitives[0].attributes["KHR_gaussian_splatting:ROTATION"] = gltf.accessors.length;
  gltf.accessors.push({
    "componentType": 5126,
    "count": cloud.numPoints,
    "type": "VEC4"
  });

  gltf.meshes[0].primitives[0].attributes["KHR_gaussian_splatting:SCALE"] = gltf.accessors.length;
  gltf.accessors.push({
    "componentType": 5126,
    "count": cloud.numPoints,
    "type": "VEC3"
  });

  if(cloud.shDegree > 0) {
    for(let i = 0; i < 3; i++) {
      gltf.meshes[0].primitives[0].attributes[`KHR_gaussian_splatting:SH_DEGREE_1_COEF_${i}`] = gltf.accessors.length;
      gltf.accessors.push({
        "componentType": 5126,
        "count": cloud.numPoints,
        "type": "VEC3"
      });
    }
  }

  if(cloud.shDegree > 1) {
    for(let i = 0; i < 5; i++) {
      gltf.meshes[0].primitives[0].attributes[`KHR_gaussian_splatting:SH_DEGREE_2_COEF_${i}`] = gltf.accessors.length;
      gltf.accessors.push({
        "componentType": 5126,
        "count": cloud.numPoints,
        "type": "VEC3"
      });
    }
  }

  if(cloud.shDegree > 2) {
    for(let i = 0; i < 7; i++) {
      gltf.meshes[0].primitives[0].attributes[`KHR_gaussian_splatting:SH_DEGREE_3_COEF_${i}`] = gltf.accessors.length;
      gltf.accessors.push({
        "componentType": 5126,
        "count": cloud.numPoints,
        "type": "VEC3"
      });
    }
  }

  const paddedSpzSize = Math.ceil(spzBytes.length / 4) * 4;
  const paddedSpzBuffer = Buffer.alloc(paddedSpzSize);
  paddedSpzBuffer.set(spzBytes, 0);
  paddedSpzBuffer.fill(0, spzBytes.length, paddedSpzSize);

  const results = getGlb(gltf, paddedSpzBuffer);
  await fs.promises.writeFile(output, results);
}

async function convertPlyToSpz(input, output) {
  const fileStream = fs.createReadStream(input);
  const webStream = Readable.toWeb(fileStream);
  const gaussianCloud = await loadPly(webStream);
  await writeSpzGltf(gaussianCloud, output);
}

function detectShDegree(vertex) {
  if(vertex.sh3) {
    return 3;
  } 
  else if(vertex.sh2) {
    return 2;
  }
  else if(vertex.sh1) {
    return 1;
  }

  return 0;
}

function convertJsonToGaussianCloud(json) {
  const cloud = {
    numPoints: 0,
    shDegree: 0,
    antialiased: false,
    positions: new Float32Array(),
    scales: new Float32Array(),
    rotations: new Float32Array(),
    alphas: new Float32Array(),
    colors: new Float32Array(),
    sh: new Float32Array()
  };

  if(!json || !json.vertices || json.vertices.length == 0) {
    return cloud;
  }

  cloud.shDegree = detectShDegree(json.vertices[0]);
  cloud.positions = new Float32Array(json.vertices.length * 3);
  cloud.scales = new Float32Array(json.vertices.length * 3);
  cloud.rotations = new Float32Array(json.vertices.length * 4);
  cloud.alphas = new Float32Array(json.vertices.length);
  cloud.colors = new Float32Array(json.vertices.length * 3);
  let numSh = 0;
  if(cloud.shDegree > 0) {
    numSh += 3 * 3;
  }
  if(cloud.shDegree > 1) {
    numSh += 3 * 5;
  }
  if(cloud.shDegree > 2) {
    numSh += 3 * 7;
  }
  cloud.sh = new Float32Array(numSh);

  for(let i = 0; i < json.vertices.length; i++) {
    cloud.numPoints++;
    let vertex = json.vertices[i];
    
    console.assert(vertex.position && vertex.position.length == 3);
    cloud.positions.set(vertex.position, i * 3);
    
    console.assert(vertex.scale && vertex.scale.length == 3);
    cloud.scales.set(vertex.scale, i * 3);
    
    console.assert(vertex.rotation && vertex.rotation.length == 4);
    cloud.rotations.set(vertex.rotation, i * 4);
    
    console.assert(vertex.color && vertex.color.length == 4);
    cloud.alphas.set(vertex.color[3], i);
    cloud.colors.set(vertex.color.slice(0, 3), i * 3);
    
    if(cloud.shDegree > 0) {
      console.assert(vertex.sh1 && vertex.sh1.length == 3);
      for(let j = 0; j < 3; j++) {
        console.assert(vertex.sh1[j] && vertex.sh1[j].length == 3);
        cloud.sh.set(vertex.sh1[j], i * numSh + j * 3);
      }
    }

    if(cloud.shDegree > 1) {
      console.assert(vertex.sh2 && vertex.sh2.length == 5);
      for(let j = 0; j < 5; j++) {
        console.assert(vertex.sh2[j] && vertex.sh2[j].length == 5);
        cloud.sh.set(vertex.sh2[j], i * numSh + 3 * 3 + j * 3);
      }
    }

    if(cloud.shDegree > 2) {
      console.assert(vertex.sh3 && vertex.sh3.length == 7);
      for(let j = 0; j < 7; j++) {
        console.assert(vertex.sh3[j] && vertex.sh3[j].length == 7);
        cloud.sh.set(vertex.sh3[j], i * numSh + 3 * 3 + 5 * 3 + j * 3);
      }
    }
  }

  return cloud;
}

async function convertJsonToSpz(input, output) {
  const json = JSON.parse(await fs.promises.readFile(input, "utf8"));
  await writeSpzGltf(convertJsonToGaussianCloud(json), output);
}

const argv = yargs(process.argv.slice(2))
  .usage("Usage: $0 [options]")
  .example("--input-ply input.ply --output output.gltf")
  .option("input-ply", {
    alias: "ip",
    type: "string",
    description: "PLY file to convert to an SPZ glTF."
  })
  .option("input-json", {
    alias: "ij",
    type: "string",
    description: "JSON file to convert to an SPZ glTF."
  })
  .option("output", {
    alias: "o",
    type: "string",
    description: "Destination file for generated glTF."
  })
  .conflicts("input-ply", "input-json")
  .demandOption(["o"])
  .check((argv, options) => {
    if(argv["input-ply"] && !fs.existsSync(argv["input-ply"])) {
      throw new Error(`File ${argv["input-ply"]} does not exist.`);
    }
    if(argv["input-json"] && !fs.existsSync(argv["input-json"])) {
      throw new Error(`File ${argv["input-json"]} does not exist.`);
    }
    if(!argv["input-ply"] && !argv["input-json"]) {
      throw new Error(`One of input-ply or input-json must be specified.`);
    }
    return true;
  })
  .help("h")
  .alias("h", "help")
  .parse();

if(argv["input-ply"]) {
  convertPlyToSpz(argv["input-ply"], argv.output).then(() => {
    console.log(`wrote gltf to ${argv.output}`);
  });
} else if(argv["input-json"]) {
  convertJsonToSpz(argv["input-json"], argv.output).then(() => {
    console.log(`wrote gltf to ${argv.output}`);
  });
} else {
  console.error("Error: either PLY or JSON input file required");
  process.exit(1);
}