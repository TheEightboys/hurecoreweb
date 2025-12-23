/**
 * HURE Core - Audit Logger
 * Consistent audit logging for all SuperAdmin actions
 */

const { supabaseAdmin } = require('./supabase');

/**
 * Log an audit entry
 * @param {string} type - Action type (clinic_created, clinic_activated, etc.)
 * @param {object} actor - Who performed the action { id, role, name }
 * @param {object} target - What was affected { entity, id, name }
 * @param {object} meta - Additional data
 * @param {string} reason - Optional reason (for reject/suspend)
 */
async function logAudit(type, actor, target, meta = {}, reason = null) {
    try {
        const { data, error } = await supabaseAdmin
            .from('audit_logs')
            .insert({
                type,
                actor_id: actor?.id || 'system',
                actor_role: actor?.role || 'system',
                actor_name: actor?.name || 'System',
                target_entity: target?.entity,
                target_id: target?.id,
                target_name: target?.name,
                meta,
                reason
            })
            .select()
            .single();

        if (error) {
            console.error('Audit log error:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Audit log exception:', err);
        return null;
    }
}

/**
 * Log an API call
 */
async function logApiCall(endpoint, method, statusCode, note = '', requestData = null, responseData = null) {
    try {
        const { data, error } = await supabaseAdmin
            .from('api_logs')
            .insert({
                endpoint,
                method,
                status_code: statusCode,
                note,
                request_data: requestData,
                response_data: responseData
            })
            .select()
            .single();

        if (error) {
            console.error('API log error:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('API log exception:', err);
        return null;
    }
}

// Common audit types
const AUDIT_TYPES = {
    // Clinic actions
    CLINIC_CREATED: 'clinic_created',
    CLINIC_ACTIVATED: 'clinic_activated',
    CLINIC_SUSPENDED: 'clinic_suspended',
    CLINIC_REJECTED: 'clinic_rejected',
    CLINIC_PLAN_CHANGED: 'clinic_plan_changed',

    // Email actions
    EMAIL_VERIFIED: 'email_verified',
    OTP_SENT: 'otp_sent',

    // Subscription actions
    SUBSCRIPTION_CREATED: 'subscription_created',
    SUBSCRIPTION_RENEWED: 'subscription_renewed',
    SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
    AUTORENEW_TOGGLED: 'autorenew_toggled',

    // Payment actions
    PAYMENT_INITIATED: 'payment_initiated',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAILED: 'payment_failed',

    // Promo actions
    PROMO_CREATED: 'promo_created',
    PROMO_TOGGLED: 'promo_toggled',

    // Care provisioning
    CARE_PROVISIONED: 'care_provisioned',

    // Site content
    SITE_CONTENT_UPDATED: 'site_content_updated'
};

module.exports = {
    logAudit,
    logApiCall,
    AUDIT_TYPES
};
