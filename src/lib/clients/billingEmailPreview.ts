/** Billing email builders shared with the `client-billing` Edge Function, for the admin preview. */
export { buildReminderEmail, buildThanksEmail } from "../../../supabase/functions/_shared/billing/billingEmails.ts";
export { collectBillingRecipients } from "../../../supabase/functions/_shared/billing/billingRecipients.ts";
