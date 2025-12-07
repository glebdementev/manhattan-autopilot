/**
 * FastRaycaster - Custom raycaster optimized for cylinder obstacles
 * 
 * Much faster than Three.js raycaster for InstancedMesh because we
 * use analytical ray-cylinder intersection with spatial grid lookup.
 */

export class FastRaycaster {
  constructor() {
    this.obstacles = [];
    this.terrain = null;
    this.terrainHeightFn = null;
    
    // Spatial grid for fast lookups
    this.gridCellSize = 10;
    this.grid = new Map();
    
    this.maxRange = 25;
  }
  
  /**
   * Set max raycast range
   */
  setMaxRange(range) {
    this.maxRange = range;
  }
  
  /**
   * Set terrain height function
   */
  setTerrainHeightFn(fn) {
    this.terrainHeightFn = fn;
  }
  
  /**
   * Set terrain mesh for ground raycasting
   */
  setTerrain(terrainMesh) {
    this.terrain = terrainMesh;
  }
  
  /**
   * Clear all obstacles
   */
  clearObstacles() {
    this.obstacles = [];
    this.grid.clear();
  }
  
  /**
   * Add obstacles from forest generator
   * @param {Array} obstacles - [{type, x, z, radius, minY, maxY}, ...]
   */
  addObstacles(obstacles) {
    for (const obs of obstacles) {
      this.obstacles.push(obs);
      
      // Add to spatial grid
      const cellKeys = this.getObstacleCellKeys(obs.x, obs.z, obs.radius);
      for (const key of cellKeys) {
        if (!this.grid.has(key)) {
          this.grid.set(key, []);
        }
        this.grid.get(key).push(obs);
      }
    }
  }
  
  /**
   * Get grid cell keys for an obstacle
   */
  getObstacleCellKeys(x, z, radius) {
    const keys = [];
    const minCellX = Math.floor((x - radius) / this.gridCellSize);
    const maxCellX = Math.floor((x + radius) / this.gridCellSize);
    const minCellZ = Math.floor((z - radius) / this.gridCellSize);
    const maxCellZ = Math.floor((z + radius) / this.gridCellSize);
    
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        keys.push(`${cx},${cz}`);
      }
    }
    return keys;
  }
  
  /**
   * Get cells along a ray path
   */
  getCellsAlongRay(ox, oz, dx, dz, maxDist) {
    const cells = new Set();
    const stepSize = this.gridCellSize * 0.5;
    const numSteps = Math.ceil(maxDist / stepSize);
    
    for (let i = 0; i <= numSteps; i++) {
      const t = (i / numSteps) * maxDist;
      const px = ox + dx * t;
      const pz = oz + dz * t;
      const cellX = Math.floor(px / this.gridCellSize);
      const cellZ = Math.floor(pz / this.gridCellSize);
      cells.add(`${cellX},${cellZ}`);
    }
    
    return cells;
  }
  
  /**
   * Cast a ray and return hit distance
   * @param {number} ox - Origin X
   * @param {number} oy - Origin Y
   * @param {number} oz - Origin Z
   * @param {number} dx - Direction X (normalized)
   * @param {number} dy - Direction Y (normalized)
   * @param {number} dz - Direction Z (normalized)
   * @returns {Object} - { distance, hit: boolean, point: {x,y,z} | null }
   */
  cast(ox, oy, oz, dx, dy, dz) {
    let closestDist = this.maxRange;
    let hitPoint = null;
    
    // Check terrain (ground) collision
    const terrainHit = this.castTerrain(ox, oy, oz, dx, dy, dz);
    if (terrainHit.hit && terrainHit.distance < closestDist) {
      closestDist = terrainHit.distance;
      hitPoint = terrainHit.point;
    }
    
    // Get obstacles along ray path using spatial grid
    const cells = this.getCellsAlongRay(ox, oz, dx, dz, this.maxRange);
    const checked = new Set();
    
    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (!cell) continue;
      
      for (const obs of cell) {
        const obsId = `${obs.x},${obs.z}`;
        if (checked.has(obsId)) continue;
        checked.add(obsId);
        
        const hit = this.rayCylinderIntersect(ox, oy, oz, dx, dy, dz, obs);
        if (hit.hit && hit.distance < closestDist) {
          closestDist = hit.distance;
          hitPoint = hit.point;
        }
      }
    }
    
    return {
      distance: closestDist,
      hit: closestDist < this.maxRange,
      point: hitPoint,
    };
  }
  
  /**
   * Cast ray against terrain using height function
   */
  castTerrain(ox, oy, oz, dx, dy, dz) {
    if (!this.terrainHeightFn || dy >= 0) {
      // Ray pointing up or no terrain - no hit
      return { hit: false, distance: this.maxRange, point: null };
    }
    
    // Step along ray and check terrain height
    const stepSize = 0.5;
    const maxSteps = Math.ceil(this.maxRange / stepSize);
    
    for (let i = 1; i <= maxSteps; i++) {
      const t = i * stepSize;
      const px = ox + dx * t;
      const py = oy + dy * t;
      const pz = oz + dz * t;
      
      const terrainY = this.terrainHeightFn(px, pz);
      
      if (py <= terrainY) {
        // Hit terrain - refine
        const prevT = (i - 1) * stepSize;
        const prevY = oy + dy * prevT;
        const prevTerrainY = this.terrainHeightFn(ox + dx * prevT, oz + dz * prevT);
        
        // Linear interpolation for more accurate hit point
        const ratio = (prevY - prevTerrainY) / ((prevY - prevTerrainY) - (py - terrainY));
        const hitT = prevT + (t - prevT) * ratio;
        
        return {
          hit: true,
          distance: hitT,
          point: {
            x: ox + dx * hitT,
            y: oy + dy * hitT,
            z: oz + dz * hitT,
          },
        };
      }
    }
    
    return { hit: false, distance: this.maxRange, point: null };
  }
  
  /**
   * Ray-cylinder intersection test
   * @param {number} ox,oy,oz - Ray origin
   * @param {number} dx,dy,dz - Ray direction (normalized)
   * @param {Object} cyl - {x, z, radius, minY, maxY}
   */
  rayCylinderIntersect(ox, oy, oz, dx, dy, dz, cyl) {
    // Project to 2D (XZ plane) for infinite cylinder test
    const ocx = ox - cyl.x;
    const ocz = oz - cyl.z;
    
    // Quadratic coefficients: at^2 + bt + c = 0
    const a = dx * dx + dz * dz;
    const b = 2 * (ocx * dx + ocz * dz);
    const c = ocx * ocx + ocz * ocz - cyl.radius * cyl.radius;
    
    // Ray parallel to cylinder axis
    if (a < 0.0001) {
      // Inside cylinder?
      if (c <= 0) {
        // Check Y bounds
        if (oy >= cyl.minY && oy <= cyl.maxY) {
          return { hit: true, distance: 0, point: { x: ox, y: oy, z: oz } };
        }
      }
      return { hit: false, distance: this.maxRange, point: null };
    }
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) {
      return { hit: false, distance: this.maxRange, point: null };
    }
    
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);
    
    // Check both intersection points
    for (const t of [t1, t2]) {
      if (t < 0.001 || t > this.maxRange) continue;
      
      const hitY = oy + dy * t;
      
      // Check if hit is within cylinder height bounds
      if (hitY >= cyl.minY && hitY <= cyl.maxY) {
        return {
          hit: true,
          distance: t,
          point: {
            x: ox + dx * t,
            y: hitY,
            z: oz + dz * t,
          },
        };
      }
    }
    
    return { hit: false, distance: this.maxRange, point: null };
  }
}

