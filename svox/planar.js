/**
 * Planars are the representaions of origin, clamp and skip
 */
class Planar {

    /**
     * Parse a planar representation from a string.
     * @param {string} value The string containing the planar settings.
     * @returns {object} An object with the planar values.
     */
  static parse(value) {
    if (!value)
      return undefined;
    
    value = ' ' + (value || '').toLowerCase();
      
    if (value !== ' ' && !/^(?!$)(\s+(?:none|-x|x|\+x|-y|y|\+y|-z|z|\+z|\s))+\s*$/.test(value)) {
      throw {
        name: 'SyntaxError',
        message: `Planar expression '${value}' is only allowed to be 'none' or contain -x x +x -y y +y -z z +z.`
      };  
    }
    
    let none = value.includes('none');
    return {
      nx: !none && value.includes('-x'),
       x: !none && value.includes(' x'),
      px: !none && value.includes('+x'),
      ny: !none && value.includes('-y'),
       y: !none && value.includes(' y'),
      py: !none && value.includes('+y'),
      nz: !none && value.includes('-z'),
       z: !none && value.includes(' z'),
      pz: !none && value.includes('+z')
    };
  }
  
  /**
   * Returns a planar as a string.
   * @param {object} planar The planar object.
   * @returns {string} The planar string.
   */ 
  static toString(planar) {
    if (!planar)
      return undefined;
    
    let result = '' 
               + (planar.nx ? ' -x' : '') + (planar.x ? ' x' : '') + (planar.px ? ' +x' : '')
               + (planar.ny ? ' -y' : '') + (planar.y ? ' y' : '') + (planar.py ? ' +y' : '')
               + (planar.nz ? ' -z' : '') + (planar.z ? ' z' : '') + (planar.pz ? ' +z' : '');
    return result.trim();
  }  
  
  /**
   * Combines two planars.
   * @param {object} planar1 The first planar object.
   * @param {object} planar2 The first planar object.
   * @param {object} defaultPlanar The default returned when planar1 and planar2 are both not set.
   * @returns {object} An object with the combined planar values.
   */ 
  static combine(planar1, planar2, defaultPlanar) {
    if (!planar1 && !planar2)
      return defaultPlanar;
    if (!planar1)
      return planar2;
    if (!planar2)
      return planar1;
    if (planar1 === planar2)
      return planar1;
    return {
      nx: planar1.nx || planar2.nx,
       x: planar1.x  || planar2.x,
      px: planar1.px || planar2.px,
      ny: planar1.ny || planar2.ny,
       y: planar1.y  || planar2.y,
      py: planar1.py || planar2.py,
      nz: planar1.nz || planar2.nz,
       z: planar1.z  || planar2.z,
      pz: planar1.pz || planar2.pz
    };
  }

}

// =====================================================
// /smoothvoxels/svox/boundingbox.js
// =====================================================

class BoundingBox {

  get size() { 
    if (this.minX > this.maxX)
      return { x:0, y:0, z:0};
    else
      return {
        x: this.maxX - this.minX + 1,
        y: this.maxY - this.minY + 1,
        z: this.maxZ - this.minZ + 1
      };
  }
  
  constructor() {
    this.reset();
  }
  
  reset() {
    this.minX = Number.POSITIVE_INFINITY;
    this.minY = Number.POSITIVE_INFINITY;
    this.minZ = Number.POSITIVE_INFINITY;
    this.maxX = Number.NEGATIVE_INFINITY;
    this.maxY = Number.NEGATIVE_INFINITY;
    this.maxZ = Number.NEGATIVE_INFINITY;
  }

  set(x, y, z) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.minZ = Math.min(this.minZ, z);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.maxZ = Math.max(this.maxZ, z);
  }
        
  // End of class BoundingBox
}
