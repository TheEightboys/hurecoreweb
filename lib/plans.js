/**
 * HURE Core - Plan Configuration
 * Central source of truth for all plan limits and pricing
 */

const PLAN_CONFIG = {
  core: {
    essential: {
      price: 8000,
      maxStaff: 10,
      maxLocations: 1,
      maxAdminRoles: 1,
      label: "Essential"
    },
    professional: {
      price: 15000,
      maxStaff: 30,
      maxLocations: 2,
      maxAdminRoles: 3,
      label: "Professional"
    },
    enterprise: {
      price: 25000,
      maxStaff: 75,
      maxLocations: 5,
      maxAdminRoles: 10,
      label: "Enterprise"
    }
  },
  care: {
    care_standard: {
      price: 10000,
      maxStaff: Infinity, // Unlimited
      maxLocations: 1,
      maxAdminRoles: 1,
      label: "Care Standard"
    },
    care_professional: {
      price: 18000,
      maxStaff: Infinity,
      maxLocations: 2,
      maxAdminRoles: 3,
      label: "Care Professional"
    },
    care_enterprise: {
      price: 30000,
      maxStaff: Infinity,
      maxLocations: 5,
      maxAdminRoles: 10,
      label: "Care Enterprise"
    }
  },
  bundleDiscountPercent: 20
};

/**
 * Calculate bundle pricing
 */
function calculateBundlePrice(corePlanKey, carePlanKey = 'care_standard') {
  const corePlan = PLAN_CONFIG.core[corePlanKey];
  const carePlan = PLAN_CONFIG.care[carePlanKey];
  
  if (!corePlan || !carePlan) {
    return { base: 0, final: 0, discountPercent: PLAN_CONFIG.bundleDiscountPercent };
  }
  
  const base = corePlan.price + carePlan.price;
  const final = Math.round(base * (1 - PLAN_CONFIG.bundleDiscountPercent / 100));
  
  return {
    base,
    final,
    discountPercent: PLAN_CONFIG.bundleDiscountPercent
  };
}

/**
 * Get plan details by product and key
 */
function getPlanDetails(product, planKey) {
  if (product === 'core') {
    return PLAN_CONFIG.core[planKey] || null;
  }
  if (product === 'care') {
    return PLAN_CONFIG.care[planKey] || null;
  }
  return null;
}

/**
 * Get plan price (handles bundles)
 */
function getPlanPrice(modules, planKey) {
  const isBundle = modules.includes('core') && modules.includes('care');
  
  if (isBundle) {
    const bundle = calculateBundlePrice(planKey);
    return {
      baseAmount: bundle.base,
      discountPercent: bundle.discountPercent,
      finalAmount: bundle.final,
      isBundle: true
    };
  }
  
  const product = modules.includes('care') ? 'care' : 'core';
  const plan = getPlanDetails(product, planKey);
  
  return {
    baseAmount: plan?.price || 0,
    discountPercent: 0,
    finalAmount: plan?.price || 0,
    isBundle: false
  };
}

/**
 * Check if clinic is within plan limits
 */
function checkPlanLimits(clinic, planDetails) {
  return {
    staffWithinLimit: clinic.staff_count <= planDetails.maxStaff,
    locationsWithinLimit: clinic.location_count <= planDetails.maxLocations,
    adminRolesWithinLimit: clinic.admin_role_count <= planDetails.maxAdminRoles,
    staffUsage: clinic.staff_count / planDetails.maxStaff,
    locationsUsage: clinic.location_count / planDetails.maxLocations,
    adminRolesUsage: clinic.admin_role_count / planDetails.maxAdminRoles
  };
}

module.exports = {
  PLAN_CONFIG,
  calculateBundlePrice,
  getPlanDetails,
  getPlanPrice,
  checkPlanLimits
};
