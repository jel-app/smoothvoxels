function almostEqual(x, y) {
  return Math.abs(x - y) < 0.0001;
}

function assertAlmostEqual(x, y) {
  if (!almostEqual(x, y))
    throw new Error("Assertion failed: " + x + " != " + y);
}
// Generates a clean js mesh data model, which serves as the basis for transformation in the SvoxToThreeMeshConverter or the SvoxToAFrameConverter
class SvoxMeshGenerator {

  static generate(model) {
    let t0 = performance.now();
    model.prepareForRender();
    console.log("prep for render: " + (performance.now() - t0) + "ms");
  
    const { nonCulledFaceCount } = model;

    let mesh = {
      materials: [],
      groups: [],
      indices: Array(nonCulledFaceCount * 6),
      indicesIndex: 0,
      positions: new Float32Array(nonCulledFaceCount * 4 * 3),
      positionIndex: 0,
      normals: new Float32Array(nonCulledFaceCount * 4 * 3),
      normalIndex: 0,
      colors: new Float32Array(nonCulledFaceCount * 4 * 3),
      colorIndex: 0,
      uvs: new Float32Array(nonCulledFaceCount * 4 * 2),
      uvIndex: 0,
      data: null
    };
    
    t0 = performance.now();
    model.materials.baseMaterials.forEach(function(material) {
      if (material.colorUsageCount > 0) {
        material.index = mesh.materials.length;
        mesh.materials.push(SvoxMeshGenerator._generateMaterial(material, model));
      }
    }, this);
    console.log("generate materials: " + (performance.now() - t0) + "ms");

    // TODO JEL does this matter?
    // if (model.data) {
    //   mesh.data = [];
    //   for (let d=0; d<model.data.length; d++) {
    //     mesh.data.push( { name: model.data[d].name,
    //                       width:model.data[d].values.length,
    //                       values: [] } );
    //   }
    // }
    
    t0 = performance.now();
    SvoxMeshGenerator._generateAll(model, mesh);
    console.log("Mesh generation took " + (performance.now() - t0) + " ms");
    
    t0 = performance.now();
    SvoxMeshGenerator._generateLights(model, mesh);
    console.log("Light generation took " + (performance.now() - t0) + " ms");

    return mesh;
  }
  
  static _generateMaterial(definition, modeldefinition) {
    let ao = definition.ao || modeldefinition.ao;
    
    let material = { 
        type:              definition.type,
        roughness:         definition.roughness,
        metalness:         definition.metalness,
        opacity:           definition.opacity,
        alphaTest:         definition.alphaTest,
        transparent:       definition.isTransparent,
        refractionRatio:   definition.refractionRatio,
        wireframe:         definition.wireframe || modeldefinition.wireframe,
        fog:               definition.fog,      
        vertexColors:      'FaceColors',
      
        // No back, faces are reverse instead because GLTF does not support back faces
        side:              definition.side === SVOX.DOUBLE ? SVOX.DOUBLE : SVOX.FRONT

      };

    if (definition.type !== SVOX.MATNORMAL) {
      // All materials except normal material support colors
      
      // TODO: When none of the materials needs VertexColors, we should just set the material colors instead of using vertex colors.
      //if (definition.colorCount === 1 && !definition.aoActive && !modeldefinition.ao && modeldefinition.lights.length === 0) {
      //  material.vertexColors = 'NoColors';
      //  material.color = definition.colors[0].toString();
      //}
      //else {
      //  material.vertexColors = 'VertexColors';
      //}
      material.vertexColors = 'VertexColors';
      material.color = "#FFF";
    }
    
    if (definition.emissive) {
      material.emissive = definition.emissive.color.toString();
      material.emissiveIntensity = definition.emissive.intensity;
    }
    
    if (definition.map) {
      material.map = { image:    definition.map.image, 
                       uscale:   definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale, 
                       vscale:   definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
                       uoffset:  definition.mapTransform.uoffset, 
                       voffset:  definition.mapTransform.voffset,
                       rotation: definition.mapTransform.rotation };
    }
    
    if (definition.normalMap) {
      material.normalMap = { image:    definition.normalMap.image, 
                             uscale:   definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale, 
                             vscale:   definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
                             uoffset:  definition.mapTransform.uoffset, 
                             voffset:  definition.mapTransform.voffset,
                             rotation: definition.mapTransform.rotation };
    }
    
    if (definition.roughnessMap) {
      material.roughnessMap = { image:    definition.roughnessMap.image, 
                                uscale:   definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale, 
                                vscale:   definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
                                uoffset:  definition.mapTransform.uoffset, 
                                voffset:  definition.mapTransform.voffset,
                                rotation: definition.mapTransform.rotation };
    }

    if (definition.metalnessMap) {
      material.metalnessMap = { image:    definition.metalnessMap.image, 
                                uscale:   definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale, 
                                vscale:   definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
                                uoffset:  definition.mapTransform.uoffset, 
                                voffset:  definition.mapTransform.voffset,
                                rotation: definition.mapTransform.rotation };
    }

    if (definition.emissiveMap) {
      material.emissiveMap = { image:    definition.emissiveMap.image, 
                               uscale:   definition.mapTransform.uscale === -1 ? 1 : definition.mapTransform.uscale, 
                               vscale:   definition.mapTransform.vscale === -1 ? 1 : definition.mapTransform.vscale,
                               uoffset:  definition.mapTransform.uoffset, 
                               voffset:  definition.mapTransform.voffset,
                               rotation: definition.mapTransform.rotation };
    }

    if (definition.matcap) {
      material.matcap = { image: definition.matcap.image };
    }

    if (definition.reflectionMap) {
      material.reflectionMap = { image: definition.reflectionMap.image };
    }
    
    if (definition.refractionMap) {
      material.refractionMap = { image: definition.refractionMap.image };
    }
    
    return material;
  }
  
  static _generateLights(model, mesh) {
    if (model.lights.some((light) => light.size)) {
      
      // The octahedron that will be subdivided depending on the light.detail
      let vTop      = { x: 0, y: 1, z: 0 };
      let vFront    = { x: 0, y: 0, z:-1 };
      let vRight    = { x: 1, y: 0, z: 0 };
      let vBack     = { x: 0, y: 0, z: 1 };
      let vLeft     = { x:-1, y: 0, z: 0 };
      let vBottom   = { x: 0, y:-1, z: 0 };

      let start = mesh.positionIndex;
      model.lights.filter(l => l.position).forEach(function(light) {
        if (light.size > 0) {
          let scale = light.size / 2;
          let detail = light.detail;

          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vFront, vRight,  vTop  , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vRight, vBack,   vTop  , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vBack,  vLeft,   vTop  , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vLeft,  vFront,  vTop  , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vFront, vBottom, vRight, mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vRight, vBottom, vBack , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vBack,  vBottom, vLeft , mesh);
          SvoxMeshGenerator._createLightFace(light.position, light.color, scale, detail, vLeft,  vBottom, vFront, mesh);
        }
      });
      let end = mesh.positionIndex;
      
      // Add the group for the lights (it always uses the first material, so index 0)
      mesh.groups.push( { start: start/3, count: (end-start)/3, materialIndex: 0 } );           
    }
  }
  
  static _createLightFace(position, color, scale, divisions, v0, v1, v2, mesh) {
    if (divisions === 0) {
      mesh.positions.push(position.x + v2.x * scale, position.y + v2.y * scale, position.z + v2.z * scale); 
      mesh.positions.push(position.x + v1.x * scale, position.y + v1.y * scale, position.z + v1.z * scale); 
      mesh.positions.push(position.x + v0.x * scale, position.y + v0.y * scale, position.z + v0.z * scale); 

      mesh.normals.push(0.0, 0.0, 1.0);
      mesh.normals.push(0.0, 0.0, 1.0);
      mesh.normals.push(0.0, 0.0, 1.0);

      mesh.colors.push(color.r, color.g, color.b);
      mesh.colors.push(color.r, color.g, color.b);
      mesh.colors.push(color.r, color.g, color.b);

      if (mesh.uvs) {
        mesh.uvs.push(0.0, 0.0);
        mesh.uvs.push(0.0, 0.0);
        mesh.uvs.push(0.0, 0.0);
      }    
    }
    else {
      // Recursively subdivide untill we have the number of divisions we need
      let v10 = SvoxMeshGenerator._normalize( { x:(v1.x+v0.x)/2, y:(v1.y+v0.y)/2, z:(v1.z+v0.z)/2 } );  
      let v12 = SvoxMeshGenerator._normalize( { x:(v1.x+v2.x)/2, y:(v1.y+v2.y)/2, z:(v1.z+v2.z)/2 } );
      let v02 = SvoxMeshGenerator._normalize( { x:(v0.x+v2.x)/2, y:(v0.y+v2.y)/2, z:(v0.z+v2.z)/2 } );
      SvoxMeshGenerator._createLightFace(position, color, scale, divisions-1, v10, v1,  v12, mesh);
      SvoxMeshGenerator._createLightFace(position, color, scale, divisions-1, v0,  v10, v02, mesh);
      SvoxMeshGenerator._createLightFace(position, color, scale, divisions-1, v02, v12, v2,  mesh);
      SvoxMeshGenerator._createLightFace(position, color, scale, divisions-1, v10, v12, v02, mesh);
    }
  }
  
  static _generateAll(model, mesh) {
    let shells = SvoxMeshGenerator._getAllShells(model);

    const materials = model.materials.materials;
    const { faceMaterials, faceCulled } = model;

    // Add all vertices to the geometry     
    model.materials.baseMaterials.forEach(function(baseMaterial) {
      if (baseMaterial.colorUsageCount > 0) {

        let start = mesh.indicesIndex;

        for (let faceIndex = 0, c = model.faceCount; faceIndex < c; faceIndex++) {
          const material = materials[faceMaterials[faceIndex]];

          // Check for material match and face culling from simplifier
          if (material._baseMaterial === baseMaterial && faceCulled.get(faceIndex) === 0) {
            SvoxMeshGenerator._generateFace(model, faceIndex, mesh);
          }
        }
        
          // TODO JEL shells
          //model.voxels.forEach(function(voxel) {
          //shells.forEach(function (shell) {
          //  if (shell.shellMaterialIndex === material.index &&
          //      shell.voxelMaterial === voxel.color.material) {
          //    SvoxMeshGenerator._generateVoxelShell(model, voxel, mesh, shell.distance, shell.color);
          //  }
          //}, this);
            //}
          
        // Add the group for this material
        let end = mesh.indicesIndex;
        mesh.groups.push( { start:start, count: (end-start), materialIndex:baseMaterial.index } );       
        
      }      
    }, this);       
  }

  static _generateVoxel(model, voxel, mesh) {
    for (let f = 0; f < SVOX._FACES.length; f++) {
      let face = voxel.faces[SVOX._FACES[f]];
      if (face && !face.skipped) {
      }  
    }
  }

  static _generateFace(model, faceIndex, mesh) {
    const { faceVertIndices, faceVertNormalX, faceVertNormalY, faceVertNormalZ, vertX, vertY, vertZ, faceVertColorR, faceVertColorG, faceVertColorB, faceVertUs, faceVertVs, faceMaterials, faceSmooth } = model;

    const materials = model.materials.materials;
    const material = materials[faceMaterials[faceIndex]];

    const vert0Index = faceVertIndices[faceIndex * 4];
    const vert1Index = faceVertIndices[faceIndex * 4 + 1];
    const vert2Index = faceVertIndices[faceIndex * 4 + 2];
    const vert3Index = faceVertIndices[faceIndex * 4 + 3];

    let vert0X = vertX[vert0Index];
    let vert0Y = vertY[vert0Index];
    let vert0Z = vertZ[vert0Index];
    const vert1X = vertX[vert1Index];
    const vert1Y = vertY[vert1Index];
    const vert1Z = vertZ[vert1Index];
    let vert2X = vertX[vert2Index];
    let vert2Y = vertY[vert2Index];
    let vert2Z = vertZ[vert2Index];
    const vert3X = vertX[vert3Index];
    const vert3Y = vertY[vert3Index];
    const vert3Z = vertZ[vert3Index];

    let norm0X = faceVertNormalX[faceIndex * 4];
    let norm0Y = faceVertNormalY[faceIndex * 4];
    let norm0Z = faceVertNormalZ[faceIndex * 4];
    const norm1X = faceVertNormalX[faceIndex * 4 + 1];
    const norm1Y = faceVertNormalY[faceIndex * 4 + 1];
    const norm1Z = faceVertNormalZ[faceIndex * 4 + 1];
    let norm2X = faceVertNormalX[faceIndex * 4 + 2];
    let norm2Y = faceVertNormalY[faceIndex * 4 + 2];
    let norm2Z = faceVertNormalZ[faceIndex * 4 + 2];
    const norm3X = faceVertNormalX[faceIndex * 4 + 3];
    const norm3Y = faceVertNormalY[faceIndex * 4 + 3];
    const norm3Z = faceVertNormalZ[faceIndex * 4 + 3];

    let col0R = faceVertColorR[faceIndex * 4];
    let col0G = faceVertColorG[faceIndex * 4];
    let col0B = faceVertColorB[faceIndex * 4];
    let col1R = faceVertColorR[faceIndex * 4 + 1];
    let col1G = faceVertColorG[faceIndex * 4 + 1];
    let col1B = faceVertColorB[faceIndex * 4 + 1];
    let col2R = faceVertColorR[faceIndex * 4 + 2];
    let col2G = faceVertColorG[faceIndex * 4 + 2];
    let col2B = faceVertColorB[faceIndex * 4 + 2];
    let col3R = faceVertColorR[faceIndex * 4 + 3];
    let col3G = faceVertColorG[faceIndex * 4 + 3];
    let col3B = faceVertColorB[faceIndex * 4 + 3];

    let uv0U = faceVertUs[faceIndex * 4];
    let uv0V = faceVertVs[faceIndex * 4];
    let uv1U = faceVertUs[faceIndex * 4 + 1];
    let uv1V = faceVertVs[faceIndex * 4 + 1];
    let uv2U = faceVertUs[faceIndex * 4 + 2];
    let uv2V = faceVertVs[faceIndex * 4 + 2];
    let uv3U = faceVertUs[faceIndex * 4 + 3];
    let uv3V = faceVertVs[faceIndex * 4 + 3];

    if (material.side === SVOX.BACK) {
      let swapX, swapY, swapZ;

      swapX = vert0X; swapY = vert0Y; swapZ = vert0Z;
      vert0X = vert2X; vert0Y = vert2Y; vert0Z = vert2Z;
      vert2X = swapX; vert2Y = swapY; vert2Z = swapZ;

      swapX = norm0X; swapY = norm0Y; swapZ = norm0Z;
      norm0X = norm2X; norm0Y = norm2Y; norm0Z = norm2Z;
      norm2X = swapX; norm2Y = swapY; norm2Z = swapZ;

      swapX = color0R; swapY = color0G; swapZ = color0B;
      color0R = color2R; color0G = color2G; color0B = color2B;
      color2R = swapX; color2G = swapY; color2B = swapZ;

      swapX = uv0U; swapY = uv0V;
      uv0U = uv2U; uv0V = uv2V;
      uv2U = swapX; uv2V = swapY;
    }

    const iIdx = mesh.indicesIndex;
    const indices = mesh.indices;

    const pIdx = mesh.positionIndex;
    const positions = mesh.positions;
    const baseIndex = iIdx === 0 ? 0 : (mesh.indices[iIdx - 2] + 1); // vert 3 of last triangle is max index

    // Face 1
    indices[iIdx] = baseIndex + 2;
    indices[iIdx + 1] = baseIndex + 1;
    indices[iIdx + 2] = baseIndex + 0;

    // Face 2
    indices[iIdx + 3] = baseIndex + 0;
    indices[iIdx + 4] = baseIndex + 3;
    indices[iIdx + 5] = baseIndex + 2;

    mesh.indicesIndex += 6;
        
    positions[pIdx] = vert0X;
    positions[pIdx+1] = vert0Y;
    positions[pIdx+2] = vert0Z;
    positions[pIdx+3] = vert1X;
    positions[pIdx+4] = vert1Y;
    positions[pIdx+5] = vert1Z;
    positions[pIdx+6] = vert2X;
    positions[pIdx+7] = vert2Y;
    positions[pIdx+8] = vert2Z;
    positions[pIdx+9] = vert3X;
    positions[pIdx+10] = vert3Y;
    positions[pIdx+11] = vert3Z;

    mesh.positionIndex += 12;

    const nIdx = mesh.normalIndex;
    const normals = mesh.normals;
    const smooth = faceSmooth.get(faceIndex) === 1;
    
    if (material.lighting === SVOX.SMOOTH || (material.lighting === SVOX.BOTH && smooth)) {
      normals[nIdx] = norm0X;
      normals[nIdx+1] = norm0Y;
      normals[nIdx+2] = norm0Z;
      normals[nIdx+3] = norm1X;
      normals[nIdx+4] = norm1Y;
      normals[nIdx+5] = norm1Z;
      normals[nIdx+6] = norm2X;
      normals[nIdx+7] = norm2Y;
      normals[nIdx+8] = norm2Z;
      normals[nIdx+9] = norm3X;
      normals[nIdx+10] = norm3Y;
      normals[nIdx+11] = norm3Z;
    } else {
      // Average the normals to get the flat normals
      let normFace1X = norm2X + norm1X + norm0X;
      let normFace1Y = norm2Y + norm1Y + norm0Y;
      let normFace1Z = norm2Z + norm1Z + norm0Z;
      let normFace2X = norm0X + norm3X + norm2X;
      let normFace2Y = norm0Y + norm3Y + norm2Y;
      let normFace2Z = norm0Z + norm3Z + norm2Z;

      const normFace1Length = Math.sqrt(normFace1X*normFace1X + normFace1Y*normFace1Y + normFace1Z*normFace1Z);
      const normFace2Length = Math.sqrt(normFace2X*normFace2X + normFace2Y*normFace2Y + normFace2Z*normFace2Z);

      normFace1X /= normFace1Length;
      normFace1Y /= normFace1Length;
      normFace1Z /= normFace1Length;
      normFace2X /= normFace2Length;
      normFace2Y /= normFace2Length;
      normFace2Z /= normFace2Length;

      // Average the normals to get the flat normals
      if (material.lighting === SVOX.QUAD) {
        const combinedFaceLength = Math.sqrt(normFace1X*normFace1X + normFace1Y*normFace1Y + normFace1Z*normFace1Z) + Math.sqrt(normFace2X*normFace2X + normFace2Y*normFace2Y + normFace2Z*normFace2Z);
        normFace1X = normFace2X = (normFace1X + normFace2X) / combinedFaceLength;
        normFace1Y = normFace2Y = (normFace1Y + normFace2Y) / combinedFaceLength;
        normFace1Z = normFace2Z = (normFace1Z + normFace2Z) / combinedFaceLength;
      }

      // Note: because of indices, this code when migrated has the wrong FLAT norm for the first and last vert of face 2
      // For now, just use QUAD
      normals[nIdx] = normFace1X;
      normals[nIdx+1] = normFace1Y;
      normals[nIdx+2] = normFace1Z;
      normals[nIdx+3] = normFace1X;
      normals[nIdx+4] = normFace1Y;
      normals[nIdx+5] = normFace1Z;
      normals[nIdx+6] = normFace1X;
      normals[nIdx+7] = normFace1Y;
      normals[nIdx+8] = normFace1Z;
      normals[nIdx+9] = normFace2X;
      normals[nIdx+10] = normFace2Y;
      normals[nIdx+11] = normFace2Z;
      
      // Code from non-indexed vertices:
      // Face 1
      //normals[nIdx] = normFace1X; // index + 2
      //normals[nIdx+1] = normFace1Y;
      //normals[nIdx+2] = normFace1Z;
      //normals[nIdx+3] = normFace1X; // index + 1
      //normals[nIdx+4] = normFace1Y;
      //normals[nIdx+5] = normFace1Z;
      //normals[nIdx+6] = normFace1X; // index + 0
      //normals[nIdx+7] = normFace1Y;
      //normals[nIdx+8] = normFace1Z;

      //// Face 2
      //normals[nIdx+9] = normFace2X; // index + 0
      //normals[nIdx+10] = normFace2Y;
      //normals[nIdx+11] = normFace2Z;
      //normals[nIdx+12] = normFace2X; // index + 3
      //normals[nIdx+13] = normFace2Y;
      //normals[nIdx+14] = normFace2Z;
      //normals[nIdx+15] = normFace2X; // index + 2
      //normals[nIdx+16] = normFace2Y;
      //normals[nIdx+17] = normFace2Z;
    }

    mesh.normalIndex += 12;

    const colIdx = mesh.colorIndex;
    const colors = mesh.colors;

    if (SVOX.clampColors) {
      // Normalize colors
      const col0Length = Math.sqrt(col0R*col0R + col0G*col0G + col0B*col0B);
      const col1Length = Math.sqrt(col1R*col1R + col1G*col1G + col1B*col1B);
      const col2Length = Math.sqrt(col2R*col2R + col2G*col2G + col2B*col2B);
      const col3Length = Math.sqrt(col3R*col3R + col3G*col3G + col3B*col3B);

      if (col0Length > 0) {
        col0R /= col0Length;
        col0G /= col0Length;
        col0B /= col0Length;
      }

      if (col1Length > 0) {
        col1R /= col1Length;
        col1G /= col1Length;
        col1B /= col1Length;
      }

      if (col2Length > 0) {
        col2R /= col2Length;
        col2G /= col2Length;
        col2B /= col2Length;
      }

      if (col3Length > 0) {
        col3R /= col3Length;
        col3G /= col3Length;
        col3B /= col3Length;
      }
    }

    // Face 1
    colors[colIdx] = col0R;
    colors[colIdx+1] = col0G;
    colors[colIdx+2] = col0B;
    colors[colIdx+3] = col1R;
    colors[colIdx+4] = col1G;
    colors[colIdx+5] = col1B;
    colors[colIdx+6] = col2R;
    colors[colIdx+7] = col2G;
    colors[colIdx+8] = col2B;
    colors[colIdx+9] = col3R;
    colors[colIdx+10] = col3G;
    colors[colIdx+11] = col3B;

    mesh.colorIndex += 12;

    const uvIdx = mesh.uvIndex;
    const uvs = mesh.uvs;

    uvs[uvIdx] = uv0U;
    uvs[uvIdx+1] = uv0V;
    uvs[uvIdx+2] = uv1U;
    uvs[uvIdx+3] = uv1V;
    uvs[uvIdx+4] = uv2U;
    uvs[uvIdx+5] = uv2V;
    uvs[uvIdx+6] = uv3U;
    uvs[uvIdx+7] = uv3V;

    mesh.uvIndex += 8;

    //if (mesh.data) {
    //  let data = voxel.material.data || model.data;
    //  for (let vertex=0;vertex<6;vertex++) {
    //    for (let d=0;d<data.length;d++) {
    //      for (let v=0;v<data[d].values.length;v++) {
    //        mesh.data[d].values.push(data[d].values[v]);
    //      }
    //    }
    //  }
    //}
  }

  static _getAllShells(model) {
   
    let shells = [];
    
    model.materials.forEach(function (material) {    
      
      let shell = undefined
      if (model.shell && model.shell.length > 0 && !material.shell)
        shell = model.shell;
      if (material.shell && material.shell.length > 0)
        shell = material.shell;
      
      if (shell) {
        shell.forEach(function (sh) {
          shells.push({
            voxelMaterial: material,
            shellMaterialIndex: sh.color.material.index,
            color: sh.color,
            distance: sh.distance
          });
        }, this);
      }
    }, this);
    
    shells.sort(function(a,b) {
      let v = a.shellMaterialIndex - b.shellMaterialIndex;
    });
    
    return shells;
  };
  
  static _generateVoxelShell(model, voxel, mesh, distance, color) {
    for (let f = 0; f < SVOX._FACES.length; f++) {
      let face = voxel.faces[SVOX._FACES[f]];
      if (face && !face.skipped) {
        SvoxMeshGenerator._generateVoxelShellFace(model, voxel, face, mesh, distance, color);
      }  
    }
  }

  static _generateVoxelShellFace(model, voxel, face, mesh, distance, color) {
    let vert0, vert1, vert2, vert3;
    let shellDirection0, shellDirection1, shellDirection2, shellDirection3;
    let norm0, norm1, norm2, norm3;
    let col0, col1, col2, col3;
    let uv0, uv1, uv2, uv3;
    
    vert0 = face.vertices[0];
    vert1 = face.vertices[1];
    vert2 = face.vertices[2];
    vert3 = face.vertices[3];
    
    shellDirection0 = face.smoothNormals[0];
    shellDirection1 = face.smoothNormals[1];
    shellDirection2 = face.smoothNormals[2];
    shellDirection3 = face.smoothNormals[3];

    // Now set the actual normals for this face
    let normals = null;
    switch (color.material.lighting) {
      case SVOX.SMOOTH:
        normals = face.smoothNormals;
        break;
      case SVOX.BOTH:
        normals = face.smooth ? face.bothNormals : face.flatNormals; 
        break;
      default:
        normals = face.flatNormals;
        break;
    }    

    norm0 = normals[0];
    norm1 = normals[1];
    norm2 = normals[2];
    norm3 = normals[3];
    
    if (mesh.uvs) {
      uv0 = face.uv[0] || { u:0.0001, v:0.0001 };
      uv1 = face.uv[1] || { u:0.0001, v:0.9999 };
      uv2 = face.uv[2] || { u:0.9999, v:0.9999 };
      uv3 = face.uv[3] || { u:0.9999, v:0.0001 };
    }
        
    if (color.material.side === 'back') {
      let swap;
      swap = vert0; vert0 = vert2; vert2 = swap;
      swap = norm0; norm0 = norm2; norm2 = swap;
      swap = shellDirection0; shellDirection0 = shellDirection2; shellDirection2 = swap;
      swap =   uv0;   uv0 =   uv2;   uv2 = swap;
    }
    
    // Push out the vertices according to the average normals
    let vert0x = vert0.x + shellDirection0.x * distance * model.scale.x;
    let vert0y = vert0.y + shellDirection0.y * distance * model.scale.y;
    let vert0z = vert0.z + shellDirection0.z * distance * model.scale.z;
    let vert1x = vert1.x + shellDirection1.x * distance * model.scale.x;  
    let vert1y = vert1.y + shellDirection1.y * distance * model.scale.y;
    let vert1z = vert1.z + shellDirection1.z * distance * model.scale.z;
    let vert2x = vert2.x + shellDirection2.x * distance * model.scale.x;  
    let vert2y = vert2.y + shellDirection2.y * distance * model.scale.y;
    let vert2z = vert2.z + shellDirection2.z * distance * model.scale.z;
    let vert3x = vert3.x + shellDirection3.x * distance * model.scale.x;  
    let vert3y = vert3.y + shellDirection3.y * distance * model.scale.y;
    let vert3z = vert3.z + shellDirection3.z * distance * model.scale.z;
            
    // Face 1
    mesh.positions.push(vert2x, vert2y, vert2z); 
    mesh.positions.push(vert1x, vert1y, vert1z); 
    mesh.positions.push(vert0x, vert0y, vert0z); 
    
    // Face 2
    mesh.positions.push(vert0x, vert0y, vert0z); 
    mesh.positions.push(vert3x, vert3y, vert3z); 
    mesh.positions.push(vert2x, vert2y, vert2z);  

    if (color.material.lighting === SVOX.SMOOTH || (color.material.lighting === SVOX.BOTH && face.smooth)) {
      // Face 1
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
      mesh.normals.push(norm1.x, norm1.y, norm1.z);
      mesh.normals.push(norm0.x, norm0.y, norm0.z);

      // Face 2
      mesh.normals.push(norm0.x, norm0.y, norm0.z);
      mesh.normals.push(norm3.x, norm3.y, norm3.z);
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
    }
    else {
      // Average the normals to get the flat normals
      let normFace1 = model._normalize({ x:norm2.x+norm1.x+norm0.x, y:norm2.y+norm1.y+norm0.y, z:norm2.z+norm1.z+norm0.z});
      let normFace2 = model._normalize({ x:norm0.x+norm3.x+norm2.x, y:norm0.y+norm3.y+norm2.y, z:norm0.z+norm3.z+norm2.z});
      if (voxel.material.lighting === SVOX.QUAD) {
        normFace1 = model._normalize({ x:normFace1.x+normFace2.x, y:normFace1.y+normFace2.y, z:normFace1.z+normFace2.z});
        normFace2 = normFace1;
      }
      
      // Face 1
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);

      // Face 2
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
    }

    for (let v=0; v<6; v++) {
      mesh.colors.push(color.r, color.g, color.b);
    }
      
    if (mesh.uvs) {     
      // Face 1
      mesh.uvs.push(uv2.u, uv2.v);
      mesh.uvs.push(uv1.u, uv1.v);
      mesh.uvs.push(uv0.u, uv0.v);

      // Face 1
      mesh.uvs.push(uv0.u, uv0.v);
      mesh.uvs.push(uv3.u, uv3.v);
      mesh.uvs.push(uv2.u, uv2.v);
    }
    
    if (mesh.data) {
      let data = voxel.material.data || model.data;
      for (let vertex=0;vertex<6;vertex++) {
        for (let d=0;d<data.length;d++) {
          for (let v=0;v<data[d].values.length;v++) {
            mesh.data.push(data[d].values[v]);
          }
        }
      }
    }    
  }
  
  static _normalize(v) {
    let l = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    v.x /= l; 
    v.y /= l; 
    v.z /= l;
    return v;
  } 
}

