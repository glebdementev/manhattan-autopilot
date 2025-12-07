/**
 * Reward Calculator for RL Environment
 * 
 * Rewards:
 * 1. TARGET REACHED: +10 (terminal)
 * 2. COLLISION: strong negative (terminal)
 * 3. DISTANCE PROGRESS: positive when approaching target
 * 4. PROXIMITY PENALTY: increases as any lidar/nadir/zenith distance shrinks
 * 5. SMALL TIME PENALTY: encourages faster completion
 */

export class RewardCalculator {
  constructor() {
    this.config = {
      // Terminal rewards
      targetReached: 10,
      // Make collisions significantly bad so "charge and crash"
      // is worse than safe but steady progress.
      collision: -10,
      
      // Distance shaping - still important, but not dominating
      // collision penalties. At 5 m/s towards target:
      // reward ~= 2 * 5 = 10 per second.
      distanceProgress: 2.0,
      // Minimum useful progress per step (in meters). If the agent
      // makes less progress than this towards the target, we treat
      // it as "idle" and apply an extra penalty.
      minProgressPerStep: 0.01,
      stagnationPenalty: -0.05,
      
      // Proximity penalty (in meters, raw lidar ranges)
      // Critical zones for obstacles / ground / ceiling.
      proximityCriticalDist: 2.0,
      proximitySeverePenalty: -2.0,
      // Ground is treated more leniently because the target itself
      // is near the ground; only penalise when extremely low.
      groundCriticalDist: 0.7,
      // Ceiling / canopy critical distance can stay fairly conservative.
      ceilingCriticalDist: 2.0,
      
      // Time penalty
      timePenalty: -0.002,
    };
  }
  
  /**
   * Calculate reward for current step
   * @param {Object} params - Reward calculation parameters
   * @returns {Object} - { reward, breakdown }
   */
  calculate(params) {
    const {
      prevDistance,
      currentDistance,
      targetRadius,
      hadCollision,
      minLidarDist,
      nadirDistance,
      zenithDistance,
    } = params;
    
    let reward = 0;
    const breakdown = {};
    
    // 1. COLLISION (terminal) - immediate failure
    if (hadCollision) {
      reward = this.config.collision;
      breakdown.collision = this.config.collision;
      return { reward, breakdown };
    }
    
    // 2. TARGET REACHED (terminal) - success!
    if (currentDistance < targetRadius) {
      reward = this.config.targetReached;
      breakdown.targetReached = this.config.targetReached;
      return { reward, breakdown };
    }
    
    // 3. DISTANCE PROGRESS (main learning signal)
    const distanceDelta = prevDistance - currentDistance;
    const progressReward = distanceDelta * this.config.distanceProgress;
    reward += progressReward;
    breakdown.progress = progressReward;

    // 3b. STAGNATION PENALTY - explicitly punish "doing nothing"
    // If the agent makes almost no progress towards the target
    // this step (in either direction), apply an extra penalty.
    if (Math.abs(distanceDelta) < this.config.minProgressPerStep) {
      reward += this.config.stagnationPenalty;
      breakdown.stagnation = this.config.stagnationPenalty;
    }
    
    // 4. PROXIMITY PENALTY - use min of forward rays, nadir, zenith
    const proximityPenalty = this.calculateProximityPenalty({
      minLidarDist,
      nadirDistance,
      zenithDistance,
    });
    if (proximityPenalty < 0) {
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // 5. TIME PENALTY (small urgency)
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Calculate proximity penalty based on distances from:
   * - forward lidar rays (obstacles)
   * - ground (nadir)
   * - ceiling/canopy (zenith)
   * 
   * Obstacles and ceiling use a ~2m critical zone.
   * Ground is treated more leniently so flying near a low target
   * is not heavily punished, while still discouraging scraping
   * the terrain.
   */
  calculateProximityPenalty({ minLidarDist, nadirDistance, zenithDistance }) {
    const {
      proximityCriticalDist,
      proximitySeverePenalty,
      groundCriticalDist,
      ceilingCriticalDist,
    } = this.config;

    let penalty = 0;

    // 1) Forward obstacles (min lidar distance)
    if (minLidarDist !== undefined && isFinite(minLidarDist)) {
      if (minLidarDist < proximityCriticalDist) {
        const clamped = Math.max(minLidarDist, 0.1);
        const ratio = proximityCriticalDist / clamped;
        const severity = ratio * ratio; // quadratic
        penalty += proximitySeverePenalty * severity;
      }
    }
    
    // 2) Ground (nadir) - more relaxed, only very low altitude penalised
    if (nadirDistance !== undefined && isFinite(nadirDistance)) {
      if (nadirDistance < groundCriticalDist) {
        const clamped = Math.max(nadirDistance, 0.1);
        const ratio = groundCriticalDist / clamped;
        const severity = ratio * ratio;
        // Ground penalty is scaled down so being near a low target is OK
        penalty += (proximitySeverePenalty * 0.5) * severity;
      }
    }

    // 3) Ceiling / canopy (zenith)
    if (zenithDistance !== undefined && isFinite(zenithDistance)) {
      if (zenithDistance < ceilingCriticalDist) {
        const clamped = Math.max(zenithDistance, 0.1);
        const ratio = ceilingCriticalDist / clamped;
        const severity = ratio * ratio;
        penalty += proximitySeverePenalty * severity;
      }
    }

    return penalty;
  }
  
  /**
   * Reset state (call on episode reset)
   */
  reset() {
    // No state to reset
  }
  
  /**
   * Get reward configuration
   */
  getConfig() {
    return { ...this.config };
  }
}
