# spz-gltf-converter

Converts gaussian splats to glTFs containing [spz](https://github.com/nianticlabs/spz) data using the [`KHR_gaussian_splatting`](https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting) and [`KHR_gaussian_splatting_compression_spz_2`](https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting_compression_spz_2) extensions.

This is a quick and dirty tool made for producing test data. It should not be relied on for anything serious and should certainly not be viewed as any kind of reference implementation.

## Usage

```
Usage: [options]

Options:
      --version           Show version number                          [boolean]
      --input-ply, --ip   PLY file to convert to an SPZ glTF.           [string]
      --input-json, --ij  JSON file to convert to an SPZ glTF.          [string]
  -o, --output            Destination file for generated glTF.
                                                             [string] [required]
  -h, --help              Show help                                    [boolean]

Examples:
  --input-ply input.ply --output output.gltf
```

### PLY data

PLY data is loaded through spz's PLY support. SPZ only supports binary little endian PLY data.

### JSON data

For ease of crafting reference models by hand, a JSON model format is also accepted. The format goes as follows:
```
{
  "vertices": [
    {
      "position": [x, y, z],
      "scale": [x, y, z],
      "rotation": [x, y, z, w],
      "color": [r, g, b, a],
      // sh1..sh3 are optional
      // if sh2 is specified, sh1 should be specified, and so on
      // if one vertex specifies spherical harmonic values, every other vertex should specify the same degrees
      "sh1": [
        [x, y, z],
        [x, y, z],
        [x, y, z]
      ],
      "sh2": [
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z]
      ],
      "sh3": [
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z],
        [x, y, z]
      ]
    }
  ]
}
```