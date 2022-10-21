import { DOUBLE, FRONT, MATNORMAL, BACK, SMOOTH, BOTH, QUAD } from './constants'

// Generates a clean js mesh data model, which serves as the basis for transformation in the SvoxToThreeMeshConverter or the SvoxToAFrameConverter
export default class SvoxMeshGenerator {
  static generate (model, buffers) {
    // let t0 = performance.now()
    model.prepareForRender(buffers)
    // console.log('prep for render: ' + (performance.now() - t0) + 'ms')

    const { nonCulledFaceCount } = model

    const mesh = {
      materials: [],
      groups: [],
      indices: Array(nonCulledFaceCount * 6),
      indicesIndex: 0,
      maxIndex: -1,
      positions: new Float32Array(nonCulledFaceCount * 4 * 3),
      positionIndex: 0,
      normals: new Float32Array(nonCulledFaceCount * 4 * 3),
      normalIndex: 0,
      colors: new Float32Array(nonCulledFaceCount * 4 * 3),
      colorIndex: 0,
      uvs: new Float32Array(nonCulledFaceCount * 4 * 2),
      uvIndex: 0,
      data: null
    }

    // t0 = performance.now()
    model.materials.baseMaterials.forEach(function (material) {
      // if (material.colorUsageCount > 0) {
      material.index = mesh.materials.length
      mesh.materials.push(SvoxMeshGenerator._generateMaterial(material, model))
      // }
    }, this)
    // console.log('generate materials: ' + (performance.now() - t0) + 'ms')

    // TODO JEL does this matter?
    // if (model.data) {
    //   mesh.data = [];
    //   for (let d=0; d<model.data.length; d++) {
    //     mesh.data.push( { name: model.data[d].name,
    //                       width:model.data[d].values.length,
    //                       values: [] } );
    //   }
    // }

    // t0 = performance.now()
    SvoxMeshGenerator._generateAll(model, mesh, buffers)
    // console.log('Mesh generation took ' + (performance.now() - t0) + ' ms')

    return mesh
  }

  static _generateMaterial (definition, modeldefinition) {
    const material = {
      type: definition.type,
      roughness: definition.roughness,
      metalness: definition.metalness,
      opacity: definition.opacity,
      alphaTest: definition.alphaTest,
      transparent: definition.isTransparent,
      refractionRatio: definition.refractionRatio,
      wireframe: definition.wireframe || modeldefinition.wireframe,
      fog: definition.fog,
      vertexColors: true,

      // No back, faces are reverse instead because GLTF does not support back faces
      side: definition.side === DOUBLE ? DOUBLE : FRONT

    }

    if (definition.type !== MATNORMAL) {
      // All materials except normal material support colors

      // TODO: When none of the materials needs VertexColors, we should just set the material colors instead of using vertex colors.
      // if (definition.colorCount === 1 && !definition.aoActive && !modeldefinition.ao && modeldefinition.lights.length === 0) {
      //  material.vertexColors = 'NoColors';
      //  material.color = definition.colors[0].toString();
      // }
      // else {
      //  material.vertexColors = 'VertexColors';
      // }
      material.color = '#FFF'
    }

    if (definition.emissive) {
      material.emissive = definition.emissive.color.toString()
      material.emissiveIntensity = definition.emissive.intensity
    }

    if (definition.map) {
      material.map = {
        image: definition.map.image,
        uscale: definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale,
        vscale: definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
        uoffset: definition.mapTransform.uoffset,
        voffset: definition.mapTransform.voffset,
        rotation: definition.mapTransform.rotation
      }
    }

    if (definition.normalMap) {
      material.normalMap = {
        image: definition.normalMap.image,
        uscale: definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale,
        vscale: definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
        uoffset: definition.mapTransform.uoffset,
        voffset: definition.mapTransform.voffset,
        rotation: definition.mapTransform.rotation
      }
    }

    if (definition.roughnessMap) {
      material.roughnessMap = {
        image: definition.roughnessMap.image,
        uscale: definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale,
        vscale: definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
        uoffset: definition.mapTransform.uoffset,
        voffset: definition.mapTransform.voffset,
        rotation: definition.mapTransform.rotation
      }
    }

    if (definition.metalnessMap) {
      material.metalnessMap = {
        image: definition.metalnessMap.image,
        uscale: definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale,
        vscale: definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
        uoffset: definition.mapTransform.uoffset,
        voffset: definition.mapTransform.voffset,
        rotation: definition.mapTransform.rotation
      }
    }

    if (definition.emissiveMap) {
      material.emissiveMap = {
        image: definition.emissiveMap.image,
        uscale: definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale,
        vscale: definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
        uoffset: definition.mapTransform.uoffset,
        voffset: definition.mapTransform.voffset,
        rotation: definition.mapTransform.rotation
      }
    }

    if (definition.matcap) {
      material.matcap = { image: definition.matcap.image }
    }

    if (definition.reflectionMap) {
      material.reflectionMap = { image: definition.reflectionMap.image }
    }

    if (definition.refractionMap) {
      material.refractionMap = { image: definition.refractionMap.image }
    }

    return material
  }

  static _generateAll (model, mesh, buffers) {
    const materials = model.materials.materials
    const { faceMaterials, faceCulled } = buffers

    // Add all vertices to the geometry
    model.materials.baseMaterials.forEach(function (baseMaterial) {
      const start = mesh.indicesIndex

      for (let faceIndex = 0, c = model.faceCount; faceIndex < c; faceIndex++) {
        const material = materials[faceMaterials[faceIndex]]

        // Check for material match and face culling from simplifier
        if (material._baseMaterial === baseMaterial && faceCulled.get(faceIndex) === 0) {
          SvoxMeshGenerator._generateFace(model, buffers, faceIndex, mesh)
        }
      }

      // Add the group for this material
      const end = mesh.indicesIndex
      mesh.groups.push({ start, count: (end - start), materialIndex: baseMaterial.index })
    }, this)

    mesh.indices.length = mesh.indicesIndex
  }

  static _generateFace (model, buffers, faceIndex, mesh) {
    const { faceVertIndices, faceVertNormalX, faceVertNormalY, faceVertNormalZ, vertX, vertY, vertZ, faceVertColorR, faceVertColorG, faceVertColorB, faceVertUs, faceVertVs, faceMaterials, faceSmooth } = buffers

    const materials = model.materials.materials
    const material = materials[faceMaterials[faceIndex]]

    const vert0Index = faceVertIndices[faceIndex * 4]
    const vert1Index = faceVertIndices[faceIndex * 4 + 1]
    const vert2Index = faceVertIndices[faceIndex * 4 + 2]
    const vert3Index = faceVertIndices[faceIndex * 4 + 3]

    let vert0X = vertX[vert0Index]
    let vert0Y = vertY[vert0Index]
    let vert0Z = vertZ[vert0Index]
    const vert1X = vertX[vert1Index]
    const vert1Y = vertY[vert1Index]
    const vert1Z = vertZ[vert1Index]
    let vert2X = vertX[vert2Index]
    let vert2Y = vertY[vert2Index]
    let vert2Z = vertZ[vert2Index]
    const vert3X = vertX[vert3Index]
    const vert3Y = vertY[vert3Index]
    const vert3Z = vertZ[vert3Index]

    let norm0X = faceVertNormalX[faceIndex * 4]
    let norm0Y = faceVertNormalY[faceIndex * 4]
    let norm0Z = faceVertNormalZ[faceIndex * 4]
    let norm1X = faceVertNormalX[faceIndex * 4 + 1]
    let norm1Y = faceVertNormalY[faceIndex * 4 + 1]
    let norm1Z = faceVertNormalZ[faceIndex * 4 + 1]
    let norm2X = faceVertNormalX[faceIndex * 4 + 2]
    let norm2Y = faceVertNormalY[faceIndex * 4 + 2]
    let norm2Z = faceVertNormalZ[faceIndex * 4 + 2]
    let norm3X = faceVertNormalX[faceIndex * 4 + 3]
    let norm3Y = faceVertNormalY[faceIndex * 4 + 3]
    let norm3Z = faceVertNormalZ[faceIndex * 4 + 3]

    let col0R = faceVertColorR[faceIndex * 4]
    let col0G = faceVertColorG[faceIndex * 4]
    let col0B = faceVertColorB[faceIndex * 4]
    const col1R = faceVertColorR[faceIndex * 4 + 1]
    const col1G = faceVertColorG[faceIndex * 4 + 1]
    const col1B = faceVertColorB[faceIndex * 4 + 1]
    let col2R = faceVertColorR[faceIndex * 4 + 2]
    let col2G = faceVertColorG[faceIndex * 4 + 2]
    let col2B = faceVertColorB[faceIndex * 4 + 2]
    const col3R = faceVertColorR[faceIndex * 4 + 3]
    const col3G = faceVertColorG[faceIndex * 4 + 3]
    const col3B = faceVertColorB[faceIndex * 4 + 3]

    let uv0U = faceVertUs[faceIndex * 4]
    let uv0V = faceVertVs[faceIndex * 4]
    const uv1U = faceVertUs[faceIndex * 4 + 1]
    const uv1V = faceVertVs[faceIndex * 4 + 1]
    let uv2U = faceVertUs[faceIndex * 4 + 2]
    let uv2V = faceVertVs[faceIndex * 4 + 2]
    const uv3U = faceVertUs[faceIndex * 4 + 3]
    const uv3V = faceVertVs[faceIndex * 4 + 3]

    if (material.side === BACK) {
      let swapX, swapY, swapZ

      swapX = vert0X; swapY = vert0Y; swapZ = vert0Z
      vert0X = vert2X; vert0Y = vert2Y; vert0Z = vert2Z
      vert2X = swapX; vert2Y = swapY; vert2Z = swapZ

      swapX = norm0X; swapY = norm0Y; swapZ = norm0Z
      norm0X = norm2X; norm0Y = norm2Y; norm0Z = norm2Z
      norm2X = swapX; norm2Y = swapY; norm2Z = swapZ

      swapX = col0R; swapY = col0G; swapZ = col0B
      col0R = col2R; col0G = col2G; col0B = col2B
      col2R = swapX; col2G = swapY; col2B = swapZ

      swapX = uv0U; swapY = uv0V
      uv0U = uv2U; uv0V = uv2V
      uv2U = swapX; uv2V = swapY
    }

    const smooth = faceSmooth.get(faceIndex) === 1

    if (!(material.lighting === SMOOTH || (material.lighting === BOTH && smooth))) {
      // Average the normals to get the flat normals
      let normFace1X = norm2X + norm1X + norm0X
      let normFace1Y = norm2Y + norm1Y + norm0Y
      let normFace1Z = norm2Z + norm1Z + norm0Z
      let normFace2X = norm0X + norm3X + norm2X
      let normFace2Y = norm0Y + norm3Y + norm2Y
      let normFace2Z = norm0Z + norm3Z + norm2Z

      const normFace1Length = Math.sqrt(normFace1X * normFace1X + normFace1Y * normFace1Y + normFace1Z * normFace1Z)
      const normFace2Length = Math.sqrt(normFace2X * normFace2X + normFace2Y * normFace2Y + normFace2Z * normFace2Z)

      const normFace1LengthInv = 1 / normFace1Length
      const normFace2LengthInv = 1 / normFace2Length

      normFace1X *= normFace1LengthInv
      normFace1Y *= normFace1LengthInv
      normFace1Z *= normFace1LengthInv
      normFace2X *= normFace2LengthInv
      normFace2Y *= normFace2LengthInv
      normFace2Z *= normFace2LengthInv

      // Average the normals to get the flat normals
      if (material.lighting === QUAD) {
        const combinedFaceLength = Math.sqrt(normFace1X * normFace1X + normFace1Y * normFace1Y + normFace1Z * normFace1Z) + Math.sqrt(normFace2X * normFace2X + normFace2Y * normFace2Y + normFace2Z * normFace2Z)
        const combinedFaceLengthInv = 1 / combinedFaceLength

        normFace1X = normFace2X = (normFace1X + normFace2X) * combinedFaceLengthInv
        normFace1Y = normFace2Y = (normFace1Y + normFace2Y) * combinedFaceLengthInv
        normFace1Z = normFace2Z = (normFace1Z + normFace2Z) * combinedFaceLengthInv
      }

      // Note: because of indices, this code when migrated has the wrong FLAT norm for the first and last vert of face 2
      // For now, just use QUAD
      norm0X = normFace1X
      norm0Y = normFace1Y
      norm0Z = normFace1Z
      norm1X = normFace1X
      norm1Y = normFace1Y
      norm1Z = normFace1Z
      norm2X = normFace1X
      norm2Y = normFace1Y
      norm2Z = normFace1Z
      norm3X = normFace2X
      norm3Y = normFace2Y
      norm3Z = normFace2Z
    }

    const indices = mesh.indices
    const positions = mesh.positions
    const normals = mesh.normals
    const colors = mesh.colors
    const uvs = mesh.uvs

    const iIdx = mesh.indicesIndex
    let pIdx = mesh.positionIndex
    let nIdx = mesh.normalIndex
    let colIdx = mesh.colorIndex
    let uvIdx = mesh.uvIndex

    const hasVert0 = false
    const hasVert1 = false
    const hasVert2 = false
    const hasVert3 = false

    let vert0Idx, vert1Idx, vert2Idx, vert3Idx

    if (hasVert0) {
    } else {
      vert0Idx = mesh.maxIndex + 1
      mesh.maxIndex = vert0Idx
      positions[pIdx] = vert0X
      positions[pIdx + 1] = vert0Y
      positions[pIdx + 2] = vert0Z
      normals[nIdx] = norm0X
      normals[nIdx + 1] = norm0Y
      normals[nIdx + 2] = norm0Z
      colors[colIdx] = col0R
      colors[colIdx + 1] = col0G
      colors[colIdx + 2] = col0B
      uvs[uvIdx] = uv0U
      uvs[uvIdx + 1] = uv0V
      pIdx += 3
      nIdx += 3
      colIdx += 3
      uvIdx += 2
      mesh.positionIndex += 3
      mesh.normalIndex += 3
      mesh.colorIndex += 3
      mesh.uvIndex += 2
    }

    if (hasVert1) {
    } else {
      vert1Idx = mesh.maxIndex + 1
      mesh.maxIndex = vert1Idx
      positions[pIdx] = vert1X
      positions[pIdx + 1] = vert1Y
      positions[pIdx + 2] = vert1Z
      normals[nIdx] = norm1X
      normals[nIdx + 1] = norm1Y
      normals[nIdx + 2] = norm1Z
      colors[colIdx] = col1R
      colors[colIdx + 1] = col1G
      colors[colIdx + 2] = col1B
      uvs[uvIdx] = uv1U
      uvs[uvIdx + 1] = uv1V
      pIdx += 3
      nIdx += 3
      colIdx += 3
      uvIdx += 2
      mesh.positionIndex += 3
      mesh.normalIndex += 3
      mesh.colorIndex += 3
      mesh.uvIndex += 2
    }

    if (hasVert2) {
    } else {
      vert2Idx = mesh.maxIndex + 1
      mesh.maxIndex = vert2Idx
      positions[pIdx] = vert2X
      positions[pIdx + 1] = vert2Y
      positions[pIdx + 2] = vert2Z
      normals[nIdx] = norm2X
      normals[nIdx + 1] = norm2Y
      normals[nIdx + 2] = norm2Z
      colors[colIdx] = col2R
      colors[colIdx + 1] = col2G
      colors[colIdx + 2] = col2B
      uvs[uvIdx] = uv2U
      uvs[uvIdx + 1] = uv2V
      pIdx += 3
      nIdx += 3
      colIdx += 3
      uvIdx += 2
      mesh.positionIndex += 3
      mesh.normalIndex += 3
      mesh.colorIndex += 3
      mesh.uvIndex += 2
    }

    if (hasVert3) {
    } else {
      vert3Idx = mesh.maxIndex + 1
      mesh.maxIndex = vert3Idx
      positions[pIdx] = vert3X
      positions[pIdx + 1] = vert3Y
      positions[pIdx + 2] = vert3Z
      normals[nIdx] = norm3X
      normals[nIdx + 1] = norm3Y
      normals[nIdx + 2] = norm3Z
      colors[colIdx] = col3R
      colors[colIdx + 1] = col3G
      colors[colIdx + 2] = col3B
      uvs[uvIdx] = uv3U
      uvs[uvIdx + 1] = uv3V
      pIdx += 3
      nIdx += 3
      colIdx += 3
      uvIdx += 2
      mesh.positionIndex += 3
      mesh.normalIndex += 3
      mesh.colorIndex += 3
      mesh.uvIndex += 2
    }

    // Face 1
    indices[iIdx] = vert2Idx
    indices[iIdx + 1] = vert1Idx
    indices[iIdx + 2] = vert0Idx

    // Face 2
    indices[iIdx + 3] = vert0Idx
    indices[iIdx + 4] = vert3Idx
    indices[iIdx + 5] = vert2Idx

    mesh.indicesIndex += 6
  }
}
