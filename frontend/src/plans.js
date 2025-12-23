/**
 * HURE Core - Plan Configuration (Frontend)
 * Matches backend lib/plans.js
 */

export const PLAN_CONFIG = {
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
            maxStaff: Infinity,
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

export function calculateBundlePrice(corePlanKey, carePlanKey = 'care_standard') {
    const corePlan = PLAN_CONFIG.core[corePlanKey];
    const carePlan = PLAN_CONFIG.care[carePlanKey];

    if (!corePlan || !carePlan) {
        return { base: 0, final: 0, discountPercent: PLAN_CONFIG.bundleDiscountPercent };
    }

    const base = corePlan.price + carePlan.price;
    const final = Math.round(base * (1 - PLAN_CONFIG.bundleDiscountPercent / 100));

    return { base, final, discountPercent: PLAN_CONFIG.bundleDiscountPercent };
}

export function getPlanLabel(product, planKey) {
    if (product === 'core') return PLAN_CONFIG.core[planKey]?.label || planKey;
    if (product === 'care') return PLAN_CONFIG.care[planKey]?.label || planKey;
    return planKey;
}

export function getModulesLabel(modules, isBundle) {
    const base = modules.join(' + ');
    return isBundle ? `${base} (Bundle -20%)` : base;
}
